import {
  boardFromAscii,
  createFromBoard,
  groupAt,
  idx,
  opponent,
  play,
  type Cell,
  type Color,
  type GameState,
  type Move,
} from "@playgolite/engine";
import type { Goal, Point, Puzzle } from "./types";

/** Pad a partial top-left picture out to a full square board. */
export function padRows(rows: readonly string[], size: number): string[] {
  const out: string[] = [];
  for (let y = 0; y < size; y++) {
    const raw = (rows[y] ?? "").replace(/\s+/g, "");
    out.push(raw.padEnd(size, ".").slice(0, size));
  }
  return out;
}

export function puzzleSize(p: Pick<Puzzle, "size">): number {
  return p.size ?? 9;
}

export function puzzleStart(p: Puzzle): GameState {
  const size = puzzleSize(p);
  const { board } = boardFromAscii(padRows(p.rows, size));
  return createFromBoard(size, board, p.toPlay, 0);
}

interface Ctx {
  goal: Goal;
  solver: Color;
  region: readonly [number, number, number, number];
  memo: Map<string, boolean>;
}

function targetIdx(state: GameState, goal: Goal): number {
  return idx(state.size, goal.at[0], goal.at[1]);
}

/** Has the goal been reached or lost on the board right now? */
function status(state: GameState, ctx: Ctx): "won" | "lost" | "open" {
  const stone = state.board[targetIdx(state, ctx.goal)];
  if (ctx.goal.type === "capture") {
    return stone === opponent(ctx.solver) ? "open" : "won";
  }
  return stone === ctx.solver ? "open" : "lost";
}

/** Legal points inside the region for the player to move. */
function candidates(state: GameState, region: Ctx["region"]): Array<{ x: number; y: number; next: GameState }> {
  const out: Array<{ x: number; y: number; next: GameState }> = [];
  const [x0, y0, x1, y1] = region;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (x >= state.size || y >= state.size) continue;
      if (state.board[idx(state.size, x, y)] !== 0) continue;
      const r = play(state, { kind: "play", x, y });
      if (r.ok) out.push({ x, y, next: r.state });
    }
  }
  return out;
}

function foeReplies(state: GameState, ctx: Ctx): Array<{ move: Move; next: GameState }> {
  const out: Array<{ move: Move; next: GameState }> = candidates(state, ctx.region).map((c) => ({
    move: { kind: "play", x: c.x, y: c.y } as Move,
    next: c.next,
  }));
  const pass = play(state, { kind: "pass" });
  if (pass.ok) out.push({ move: { kind: "pass" }, next: pass.state });
  return out;
}

/** After the solver played `s1`, does the goal still get forced with `movesLeft` solver moves left (including this one)? */
function moveWins(s1: GameState, ctx: Ctx, movesLeft: number): boolean {
  const st = status(s1, ctx);
  if (st === "won") return true;
  if (st === "lost") return false;
  if (ctx.goal.type === "capture" && movesLeft <= 1) return false;
  for (const r of foeReplies(s1, ctx)) {
    if (status(r.next, ctx) === "lost") return false;
    if (movesLeft > 1 && !solverWins(r.next, ctx, movesLeft - 1)) return false;
  }
  return true;
}

function solverWins(state: GameState, ctx: Ctx, movesLeft: number): boolean {
  const key = `${state.hash}|${state.toPlay}|${movesLeft}`;
  const cached = ctx.memo.get(key);
  if (cached !== undefined) return cached;
  let result = false;
  for (const c of candidates(state, ctx.region)) {
    if (moveWins(c.next, ctx, movesLeft)) {
      result = true;
      break;
    }
  }
  ctx.memo.set(key, result);
  return result;
}

function makeCtx(p: Pick<Puzzle, "goal" | "toPlay" | "region">): Ctx {
  return { goal: p.goal, solver: p.toPlay, region: p.region, memo: new Map() };
}

/** Every first move (inside the region) that forces the goal. */
export function winningMoves(p: Puzzle, from: GameState = puzzleStart(p), movesLeft = p.depth): Point[] {
  const ctx = makeCtx(p);
  const out: Point[] = [];
  for (const c of candidates(from, p.region)) {
    if (moveWins(c.next, ctx, movesLeft)) out.push([c.x, c.y]);
  }
  return out;
}

function targetLiberties(state: GameState, goal: Goal): number {
  const i = targetIdx(state, goal);
  if (state.board[i] === 0) return 0;
  return groupAt(state.board, state.size, i).liberties.length;
}

/**
 * Note on `movesLeft` for refutation, bestDefense and playerMoveWins: it counts the
 * player's moves still available INCLUDING the one just played into `afterPlayerMove`.
 * At the start of a puzzle that is `puzzle.depth`; after each full exchange it drops by one.
 */

/**
 * A reply that beats the player's move. For capture goals this is the move that
 * gives the target group the most liberties, which looks like the natural escape.
 */
export function refutation(p: Puzzle, afterPlayerMove: GameState, movesLeft: number): Move | null {
  const ctx = makeCtx(p);
  let best: { move: Move; score: number } | null = null;
  for (const r of foeReplies(afterPlayerMove, ctx)) {
    let refutes: boolean;
    if (status(r.next, ctx) === "lost") refutes = true;
    else if (movesLeft <= 1) refutes = p.goal.type === "capture";
    else refutes = !solverWins(r.next, ctx, movesLeft - 1);
    if (!refutes) continue;
    const captured = status(r.next, ctx) === "lost";
    const score = captured ? 1000 : p.goal.type === "capture" ? targetLiberties(r.next, p.goal) : -targetLiberties(r.next, p.goal);
    if (!best || score > best.score) best = { move: r.move, score };
  }
  return best ? best.move : null;
}

/**
 * The strongest defence after a correct move: a reply that does not stop the
 * player, chosen to make the target hardest to finish (most liberties).
 */
export function bestDefense(p: Puzzle, afterPlayerMove: GameState, movesLeft: number): Move | null {
  const ctx = makeCtx(p);
  let best: { move: Move; score: number } | null = null;
  for (const r of foeReplies(afterPlayerMove, ctx)) {
    if (status(r.next, ctx) === "lost") continue;
    if (movesLeft > 1 && !solverWins(r.next, ctx, movesLeft - 1)) continue;
    if (movesLeft <= 1 && p.goal.type === "capture") continue;
    const score = p.goal.type === "capture" ? targetLiberties(r.next, p.goal) : -targetLiberties(r.next, p.goal);
    if (!best || score > best.score) best = { move: r.move, score };
  }
  return best ? best.move : null;
}

/** Does this player move force the goal? */
export function playerMoveWins(p: Puzzle, afterPlayerMove: GameState, movesLeft: number): boolean {
  return moveWins(afterPlayerMove, makeCtx(p), movesLeft);
}

export function goalStatus(p: Puzzle, state: GameState): "won" | "lost" | "open" {
  return status(state, makeCtx(p));
}

export type { Cell };
