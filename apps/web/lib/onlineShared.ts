/** Code shared by the server and the browser for online games. No server-only imports here. */
import { createGame, play, resumePlay, type GameState } from "@playgolite/engine";

export const ONLINE_SIZES = [9, 13, 19, 21] as const;

export interface TimePreset {
  id: string;
  kind: "live" | "daily";
  label: string;
  mainMs: number;
  incMs: number;
}

export const TIME_PRESETS: TimePreset[] = [
  { id: "live-5-3", kind: "live", label: "5 min + 3 s", mainMs: 5 * 60_000, incMs: 3_000 },
  { id: "live-10-5", kind: "live", label: "10 min + 5 s", mainMs: 10 * 60_000, incMs: 5_000 },
  { id: "live-20-10", kind: "live", label: "20 min + 10 s", mainMs: 20 * 60_000, incMs: 10_000 },
  { id: "daily-1", kind: "daily", label: "1 day per move", mainMs: 24 * 3_600_000, incMs: 0 },
  { id: "daily-3", kind: "daily", label: "3 days per move", mainMs: 72 * 3_600_000, incMs: 0 },
];

export const SCORING_WINDOW_MS = { live: 10 * 60_000, daily: 3 * 24 * 3_600_000 };
export const MAX_RESUMES = 3;

const A = "a".charCodeAt(0);

/** "pass", "resume", or two letters for a point (a = 0). */
export function encodeMove(x: number, y: number): string {
  return String.fromCharCode(A + x) + String.fromCharCode(A + y);
}

export function decodeMove(token: string): { x: number; y: number } | null {
  if (token.length !== 2) return null;
  const x = token.charCodeAt(0) - A;
  const y = token.charCodeAt(1) - A;
  return x >= 0 && y >= 0 ? { x, y } : null;
}

/** Rebuild a game position from its move tokens. Throws if a token is not playable. */
export function replayMoves(size: number, komi: number, tokens: readonly string[]): GameState {
  let state = createGame({ size, komi });
  for (const t of tokens) {
    if (t === "resume") {
      state = resumePlay(state);
      continue;
    }
    if (t === "pass") {
      const r = play(state, { kind: "pass" });
      if (!r.ok) throw new Error("bad pass in game record");
      state = r.state;
      continue;
    }
    const p = decodeMove(t);
    if (!p) throw new Error(`bad move token ${t}`);
    const r = play(state, { kind: "play", x: p.x, y: p.y });
    if (!r.ok) throw new Error(`illegal move in game record: ${t} (${r.reason})`);
    state = r.state;
  }
  return state;
}

export interface PlayerView {
  id: string;
  username: string;
  rating: number;
}

export interface OnlineGame {
  id: string;
  size: number;
  komi: number;
  status: "open" | "playing" | "scoring" | "finished";
  creator: PlayerView;
  creatorColor: "black" | "white" | "random";
  black: PlayerView | null;
  white: PlayerView | null;
  tc: { kind: "live" | "daily"; mainMs: number; incMs: number };
  moves: string[];
  moveCount: number;
  toPlay: "black" | "white";
  blackMs: number;
  whiteMs: number;
  turnStartedAt: number | null;
  dead: number[];
  acceptBlack: boolean;
  acceptWhite: boolean;
  scoringDeadline: number | null;
  resumes: number;
  rev: number;
  /** SGF result, for example "B+R", "W+T", "B+3.5". */
  result: string | null;
  createdAt: number;
  finishedAt: number | null;
  serverNow: number;
  you: "black" | "white" | null;
}

/** Milliseconds the player to move has left, given the server clock reading. */
export function remainingMs(g: OnlineGame, color: "black" | "white", now: number): number {
  const stored = color === "black" ? g.blackMs : g.whiteMs;
  const running = g.status === "playing" && g.turnStartedAt !== null && color === g.toPlay;
  const used = running ? Math.max(0, now - (g.turnStartedAt as number)) : 0;
  return g.tc.kind === "daily" ? (running ? g.tc.mainMs - used : g.tc.mainMs) : stored - used;
}

export interface AccountUser {
  id: string;
  username: string;
  rating: number;
  ratingDev: number;
  ratedGames: number;
}

/** Plain-words name for a time preset or an online game's clock settings. */
export function describeTime(tc: { kind: "live" | "daily"; mainMs: number; incMs: number }): string {
  if (tc.kind === "daily") {
    const d = Math.round(tc.mainMs / 86_400_000);
    return `${d} day${d === 1 ? "" : "s"} per move`;
  }
  return `${Math.round(tc.mainMs / 60_000)} min + ${Math.round(tc.incMs / 1000)} s`;
}

export function formatClock(ms: number, kind: "live" | "daily"): string {
  const t = Math.max(0, ms);
  if (kind === "daily" || t >= 3_600_000) {
    const d = Math.floor(t / 86_400_000);
    const h = Math.floor((t % 86_400_000) / 3_600_000);
    const m = Math.floor((t % 3_600_000) / 60_000);
    if (d > 0) return `${d}d ${h}h`;
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  const s = Math.ceil(t / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
