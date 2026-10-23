import { randomBytes } from "node:crypto";
import { finishScoring, toggleDead, type GameState } from "@playgolite/engine";
import {
  MAX_RESUMES,
  ONLINE_SIZES,
  SCORING_WINDOW_MS,
  TIME_PRESETS,
  encodeMove,
  replayMoves,
  type OnlineGame,
  type PlayerView,
} from "../onlineShared";
import { DEFAULT_KOMI } from "@playgolite/engine";
import { num, query, type Row } from "./db";
import { HttpError } from "./http";
import type { User } from "./auth";

const SELECT = `SELECT g.*,
  c.username AS cname, c.rating AS crating,
  b.username AS bname, b.rating AS brating,
  w.username AS wname, w.rating AS wrating
  FROM pgl_games g
  JOIN pgl_users c ON c.id = g.creator_id
  LEFT JOIN pgl_users b ON b.id = g.black_id
  LEFT JOIN pgl_users w ON w.id = g.white_id`;

const MAX_OPEN = 5;
const MAX_ACTIVE = 25;

function newId(): string {
  return randomBytes(6).toString("base64url");
}

const tokens = (r: Row): string[] => (String(r.moves) ? String(r.moves).split(",") : []);
const deadList = (r: Row): number[] => (String(r.dead) ? String(r.dead).split(",").map(Number) : []);

function stateOf(r: Row): GameState {
  const base = replayMoves(num(r.size), num(r.komi), tokens(r));
  return { ...base, dead: deadList(r) };
}

function scoringDeadline(r: Row): number | null {
  if (r.status !== "scoring" || r.scoring_started_at === null) return null;
  const window = r.tc_kind === "daily" ? SCORING_WINDOW_MS.daily : SCORING_WINDOW_MS.live;
  return num(r.scoring_started_at) + window;
}

function toView(r: Row, userId: string | null, now: number): OnlineGame {
  const player = (id: unknown, name: unknown, rating: unknown): PlayerView | null =>
    id ? { id: String(id), username: String(name), rating: Math.round(num(rating)) } : null;
  const state = r.status === "open" ? null : stateOf(r);
  const toPlay = state ? (state.toPlay === 1 ? "black" : "white") : "black";
  return {
    id: String(r.id),
    size: num(r.size),
    komi: num(r.komi),
    status: r.status as OnlineGame["status"],
    creator: player(r.creator_id, r.cname, r.crating) as PlayerView,
    creatorColor: r.creator_color as OnlineGame["creatorColor"],
    black: player(r.black_id, r.bname, r.brating),
    white: player(r.white_id, r.wname, r.wrating),
    tc: { kind: r.tc_kind as "live" | "daily", mainMs: num(r.tc_main_ms), incMs: num(r.tc_inc_ms) },
    moves: tokens(r),
    moveCount: num(r.move_count),
    toPlay,
    blackMs: num(r.black_ms),
    whiteMs: num(r.white_ms),
    turnStartedAt: r.turn_started_at === null ? null : num(r.turn_started_at),
    dead: deadList(r),
    acceptBlack: Boolean(r.accept_black),
    acceptWhite: Boolean(r.accept_white),
    scoringDeadline: scoringDeadline(r),
    resumes: num(r.resumes),
    rev: num(r.rev),
    result: r.result === null ? null : String(r.result),
    createdAt: num(r.created_at),
    finishedAt: r.finished_at === null ? null : num(r.finished_at),
    serverNow: now,
    you: userId && r.black_id === userId ? "black" : userId && r.white_id === userId ? "white" : null,
  };
}

async function load(id: string): Promise<Row> {
  if (!/^[A-Za-z0-9_-]{6,16}$/.test(id)) throw new HttpError(404, "That game does not exist.");
  const rows = await query(`${SELECT} WHERE g.id = $1`, [id]);
  if (!rows[0]) throw new HttpError(404, "That game does not exist.");
  return rows[0];
}

/** Write changes only if nobody else has changed the game since we read it. */
async function save(r: Row, set: Record<string, unknown>): Promise<void> {
  const keys = Object.keys(set);
  const params: unknown[] = keys.map((k) => set[k]);
  const assigns = keys.map((k, i) => `${k} = $${i + 1}`);
  params.push(r.id, r.rev);
  const done = await query(
    `UPDATE pgl_games SET ${assigns.join(", ")}, rev = rev + 1 WHERE id = $${keys.length + 1} AND rev = $${keys.length + 2} RETURNING id`,
    params,
  );
  if (done.length === 0) throw new HttpError(409, "The game changed. Refreshing.", { code: "stale" });
}

function resultFor(state: GameState): string {
  const res = state.result;
  if (!res || res.winner === null) return "0";
  const w = res.winner === 1 ? "B" : "W";
  if (res.reason === "resign") return `${w}+R`;
  if (res.reason === "timeout") return `${w}+T`;
  return `${w}+${res.margin}`;
}

const colorName = (c: 1 | 2) => (c === 1 ? "black" : "white");

/** Apply anything that happened just because time passed: flags falling and scoring windows closing. */
async function settle(r: Row, now: number): Promise<Row> {
  if (r.status === "playing" && r.turn_started_at !== null) {
    const state = stateOf(r);
    const mover = colorName(state.toPlay);
    const elapsed = now - num(r.turn_started_at);
    const left = r.tc_kind === "daily" ? num(r.tc_main_ms) : num(mover === "black" ? r.black_ms : r.white_ms);
    if (elapsed > left) {
      const winner = mover === "black" ? "W" : "B";
      await save(r, {
        status: "finished",
        result: `${winner}+T`,
        finished_at: now,
        turn_started_at: null,
        ...(r.tc_kind === "live" ? { [mover === "black" ? "black_ms" : "white_ms"]: 0 } : {}),
      });
      return load(String(r.id));
    }
  }
  const deadline = scoringDeadline(r);
  if (deadline !== null && now > deadline) {
    const done = finishScoring(stateOf(r));
    await save(r, { status: "finished", result: resultFor(done), finished_at: now });
    return load(String(r.id));
  }
  return r;
}

export async function createGame(
  user: User,
  opts: { size: unknown; color: unknown; time: unknown },
): Promise<OnlineGame> {
  const size = Number(opts.size);
  if (!(ONLINE_SIZES as readonly number[]).includes(size)) throw new HttpError(400, "Pick a board size.");
  const color = opts.color === "black" || opts.color === "white" ? opts.color : "random";
  const preset = TIME_PRESETS.find((p) => p.id === opts.time);
  if (!preset) throw new HttpError(400, "Pick a time setting.");

  const open = await query(`SELECT count(*)::int AS n FROM pgl_games WHERE creator_id = $1 AND status = 'open'`, [user.id]);
  if (num(open[0]?.n) >= MAX_OPEN) throw new HttpError(429, "You already have several open games waiting. Cancel one first.");
  const active = await query(
    `SELECT count(*)::int AS n FROM pgl_games WHERE (black_id = $1 OR white_id = $1) AND status IN ('playing','scoring')`,
    [user.id],
  );
  if (num(active[0]?.n) >= MAX_ACTIVE) throw new HttpError(429, "You have a lot of games running already.");

  const id = newId();
  await query(
    `INSERT INTO pgl_games (id, size, komi, creator_id, creator_color, status, tc_kind, tc_main_ms, tc_inc_ms, black_ms, white_ms, created_at)
     VALUES ($1,$2,$3,$4,$5,'open',$6,$7,$8,$7,$7,$9)`,
    [id, size, DEFAULT_KOMI[size] ?? 7.5, user.id, color, preset.kind, preset.mainMs, preset.incMs, Date.now()],
  );
  return toView(await load(id), user.id, Date.now());
}

export async function getGame(id: string, userId: string | null): Promise<OnlineGame> {
  const now = Date.now();
  const r = await settle(await load(id), now);
  return toView(r, userId, now);
}

export async function listGames(user: User, scope: string): Promise<OnlineGame[]> {
  const now = Date.now();
  const rows =
    scope === "open"
      ? await query(`${SELECT} WHERE g.status = 'open' AND g.creator_id <> $1 ORDER BY g.created_at DESC LIMIT 30`, [user.id])
      : await query(
          `${SELECT} WHERE g.creator_id = $1 OR g.black_id = $1 OR g.white_id = $1
           ORDER BY CASE g.status WHEN 'finished' THEN 1 ELSE 0 END, g.created_at DESC LIMIT 60`,
          [user.id],
        );
  const out: OnlineGame[] = [];
  for (const r of rows) {
    const settled = r.status === "playing" || r.status === "scoring" ? await settle(r, now).catch(() => r) : r;
    out.push({ ...toView(settled, user.id, now), moves: [] });
  }
  return out;
}

export async function joinGame(user: User, id: string): Promise<OnlineGame> {
  const now = Date.now();
  const r = await load(id);
  if (r.status !== "open") throw new HttpError(409, "That game has already started.");
  if (r.creator_id === user.id) throw new HttpError(400, "You can't join your own game.");
  const active = await query(
    `SELECT count(*)::int AS n FROM pgl_games WHERE (black_id = $1 OR white_id = $1) AND status IN ('playing','scoring')`,
    [user.id],
  );
  if (num(active[0]?.n) >= MAX_ACTIVE) throw new HttpError(429, "You have a lot of games running already.");
  const creatorBlack = r.creator_color === "black" ? true : r.creator_color === "white" ? false : randomBytes(1)[0]! < 128;
  await save(r, {
    status: "playing",
    black_id: creatorBlack ? r.creator_id : user.id,
    white_id: creatorBlack ? user.id : r.creator_id,
    turn_started_at: now,
  });
  return toView(await load(id), user.id, now);
}

export async function cancelGame(user: User, id: string): Promise<void> {
  const r = await load(id);
  if (r.creator_id !== user.id) throw new HttpError(403, "That isn't your game.");
  if (r.status !== "open") throw new HttpError(409, "That game has already started.");
  await query(`DELETE FROM pgl_games WHERE id = $1 AND status = 'open'`, [id]);
}

export type Action =
  | { type: "move"; x: number; y: number; expect: number }
  | { type: "pass"; expect: number }
  | { type: "resign" }
  | { type: "mark"; x: number; y: number }
  | { type: "accept" }
  | { type: "resume" };

export async function act(user: User, id: string, action: Action): Promise<OnlineGame> {
  const now = Date.now();
  const r = await settle(await load(id), now);
  const me = r.black_id === user.id ? "black" : r.white_id === user.id ? "white" : null;
  if (!me) throw new HttpError(403, "You aren't a player in this game.");
  const meCode = me === "black" ? 1 : 2;

  if (action.type === "resign") {
    if (r.status !== "playing" && r.status !== "scoring") throw new HttpError(409, "This game is already over.");
    await save(r, { status: "finished", result: `${me === "black" ? "W" : "B"}+R`, finished_at: now, turn_started_at: null });
    return toView(await load(id), user.id, now);
  }

  if (action.type === "move" || action.type === "pass") {
    if (r.status !== "playing") throw new HttpError(409, r.status === "finished" ? "This game is over." : "Not in play right now.");
    const state = stateOf(r);
    if (state.toPlay !== meCode) throw new HttpError(409, "It isn't your turn.", { code: "not-your-turn" });
    if (action.expect !== num(r.move_count)) throw new HttpError(409, "The board changed. Refreshing.", { code: "stale" });

    let token: string;
    let next: GameState;
    if (action.type === "pass") {
      token = "pass";
      next = replayMoves(state.size, state.komi, [...tokens(r), token]);
    } else {
      if (!Number.isInteger(action.x) || !Number.isInteger(action.y)) throw new HttpError(400, "Bad point.");
      token = encodeMove(action.x, action.y);
      try {
        next = replayMoves(state.size, state.komi, [...tokens(r), token]);
      } catch {
        throw new HttpError(400, "That move isn't legal.", { code: "illegal" });
      }
    }

    const elapsed = now - num(r.turn_started_at);
    const set: Record<string, unknown> = {
      moves: [...tokens(r), token].join(","),
      move_count: num(r.move_count) + 1,
      turn_started_at: now,
    };
    if (r.tc_kind === "live") {
      const key = me === "black" ? "black_ms" : "white_ms";
      set[key] = Math.max(0, num(r[key]) - elapsed) + num(r.tc_inc_ms);
    }
    if (next.status === "scoring") {
      set.status = "scoring";
      set.scoring_started_at = now;
      set.turn_started_at = null;
      set.accept_black = false;
      set.accept_white = false;
    }
    await save(r, set);
    return toView(await load(id), user.id, now);
  }

  // Scoring actions.
  if (r.status !== "scoring") throw new HttpError(409, "The game isn't being scored.");

  if (action.type === "mark") {
    const state = stateOf(r);
    if (!Number.isInteger(action.x) || !Number.isInteger(action.y) || action.x < 0 || action.y < 0 || action.x >= state.size || action.y >= state.size) {
      throw new HttpError(400, "Bad point.");
    }
    const next = toggleDead(state, action.x, action.y);
    await save(r, { dead: next.dead.join(","), accept_black: false, accept_white: false });
    return toView(await load(id), user.id, now);
  }

  if (action.type === "accept") {
    const flag = me === "black" ? "accept_black" : "accept_white";
    const otherAccepted = Boolean(me === "black" ? r.accept_white : r.accept_black);
    if (otherAccepted) {
      const done = finishScoring(stateOf(r));
      await save(r, { [flag]: true, status: "finished", result: resultFor(done), finished_at: now });
    } else {
      await save(r, { [flag]: true });
    }
    return toView(await load(id), user.id, now);
  }

  if (action.type === "resume") {
    if (num(r.resumes) >= MAX_RESUMES) throw new HttpError(409, "Play has already been resumed the most times allowed.");
    await save(r, {
      status: "playing",
      moves: [...tokens(r), "resume"].join(","),
      move_count: num(r.move_count) + 1,
      resumes: num(r.resumes) + 1,
      dead: "",
      accept_black: false,
      accept_white: false,
      scoring_started_at: null,
      turn_started_at: now,
    });
    return toView(await load(id), user.id, now);
  }

  throw new HttpError(400, "Unknown action.");
}
