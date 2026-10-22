import { groupAt, hashBoard, neighborsFor } from "./board";
import { score } from "./score";
import {
  BLACK,
  WHITE,
  opponent,
  type Cell,
  type Color,
  type GameState,
  type IllegalReason,
  type Move,
  type PlayResult,
} from "./types";

export const DEFAULT_KOMI: Record<number, number> = { 9: 7, 13: 7.5, 19: 7.5, 21: 7.5 };

export interface NewGameOptions {
  size?: number;
  komi?: number;
  toPlay?: Color;
}

export function createGame(opts: NewGameOptions = {}): GameState {
  const size = opts.size ?? 19;
  const board: Cell[] = new Array<Cell>(size * size).fill(0);
  return makeState(size, opts.komi ?? DEFAULT_KOMI[size] ?? 6.5, board, opts.toPlay ?? BLACK);
}

/**
 * Build a game from an existing position. Used for puzzles, lessons and tests.
 * The given position counts as the first entry in the superko history.
 */
export function createFromBoard(
  size: number,
  board: readonly Cell[],
  toPlay: Color,
  komi = DEFAULT_KOMI[size] ?? 6.5,
): GameState {
  if (board.length !== size * size) throw new Error("board length does not match size");
  return makeState(size, komi, [...board], toPlay);
}

/** Parse a picture of a board: "X" black, "O" white, "." empty. Whitespace ignored. */
export function boardFromAscii(rows: readonly string[]): { size: number; board: Cell[] } {
  const size = rows.length;
  const board: Cell[] = [];
  for (const row of rows) {
    const cells = row.replace(/\s+/g, "");
    if (cells.length !== size) throw new Error("ascii board must be square");
    for (const ch of cells) {
      board.push(ch === "X" ? BLACK : ch === "O" ? WHITE : 0);
    }
  }
  return { size, board };
}

function makeState(size: number, komi: number, board: Cell[], toPlay: Color): GameState {
  const hash = hashBoard(board);
  return {
    size,
    komi,
    board,
    toPlay,
    captures: { black: 0, white: 0 },
    hash,
    seen: [hash],
    moves: [],
    consecutivePasses: 0,
    status: "playing",
    dead: [],
  };
}

export function idx(size: number, x: number, y: number): number {
  return y * size + x;
}

export function xy(size: number, i: number): { x: number; y: number } {
  return { x: i % size, y: Math.floor(i / size) };
}

interface Attempt {
  ok: true;
  board: Cell[];
  captured: number;
  hash: string;
}

function attempt(state: GameState, x: number, y: number): Attempt | { ok: false; reason: IllegalReason } {
  if (state.status !== "playing") return { ok: false, reason: "game-over" };
  const size = state.size;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size) {
    return { ok: false, reason: "out-of-bounds" };
  }
  const p = idx(size, x, y);
  if (state.board[p] !== 0) return { ok: false, reason: "occupied" };

  const me = state.toPlay;
  const foe = opponent(me);
  const board = state.board.slice() as Cell[];
  board[p] = me;

  // Remove enemy groups left without liberties.
  let captured = 0;
  const nbrs = neighborsFor(size);
  for (const n of nbrs[p] as number[]) {
    if (board[n] === foe) {
      const g = groupAt(board, size, n);
      if (g.liberties.length === 0) {
        for (const s of g.stones) board[s] = 0;
        captured += g.stones.length;
      }
    }
  }

  // Suicide check happens after captures, so a capturing move is never suicide.
  if (groupAt(board, size, p).liberties.length === 0) {
    return { ok: false, reason: "suicide" };
  }

  const hash = hashBoard(board);
  if (state.seen.includes(hash)) return { ok: false, reason: "ko" };

  return { ok: true, board, captured, hash };
}

/** Returns why a move is illegal, or null if it is legal. */
export function illegalReason(state: GameState, x: number, y: number): IllegalReason | null {
  const r = attempt(state, x, y);
  return r.ok ? null : r.reason;
}

export function isLegal(state: GameState, x: number, y: number): boolean {
  return illegalReason(state, x, y) === null;
}

/** All legal board points for the player to move, as point indices. */
export function legalMoves(state: GameState): number[] {
  const out: number[] = [];
  if (state.status !== "playing") return out;
  for (let y = 0; y < state.size; y++) {
    for (let x = 0; x < state.size; x++) {
      if (isLegal(state, x, y)) out.push(idx(state.size, x, y));
    }
  }
  return out;
}

export function play(state: GameState, move: Move): PlayResult {
  if (state.status !== "playing") return { ok: false, reason: "game-over" };
  const me = state.toPlay;

  if (move.kind === "pass") {
    const passes = state.consecutivePasses + 1;
    return {
      ok: true,
      state: {
        ...state,
        toPlay: opponent(me),
        consecutivePasses: passes,
        status: passes >= 2 ? "scoring" : "playing",
        moves: [...state.moves, { color: me, move, captured: 0 }],
      },
    };
  }

  if (move.kind === "resign") {
    return {
      ok: true,
      state: {
        ...state,
        status: "finished",
        moves: [...state.moves, { color: me, move, captured: 0 }],
        result: { winner: opponent(me), margin: 0, reason: "resign" },
      },
    };
  }

  const r = attempt(state, move.x, move.y);
  if (!r.ok) return r;
  return {
    ok: true,
    state: {
      ...state,
      board: r.board,
      toPlay: opponent(me),
      captures: {
        black: state.captures.black + (me === BLACK ? r.captured : 0),
        white: state.captures.white + (me === WHITE ? r.captured : 0),
      },
      hash: r.hash,
      seen: [...state.seen, r.hash],
      moves: [...state.moves, { color: me, move, captured: r.captured }],
      consecutivePasses: 0,
    },
  };
}

/** Convenience: play a stone, throwing on illegal moves. */
export function playOrThrow(state: GameState, x: number, y: number): GameState {
  const r = play(state, { kind: "play", x, y });
  if (!r.ok) throw new Error(`illegal move (${x},${y}): ${r.reason}`);
  return r.state;
}

/** Scoring phase: toggle the whole group at (x, y) as dead or alive. */
export function toggleDead(state: GameState, x: number, y: number): GameState {
  if (state.status !== "scoring") return state;
  const p = idx(state.size, x, y);
  if (state.board[p] === 0 || state.board[p] === undefined) return state;
  const group = groupAt(state.board, state.size, p).stones;
  const dead = new Set(state.dead);
  const allDead = group.every((s) => dead.has(s));
  for (const s of group) {
    if (allDead) dead.delete(s);
    else dead.add(s);
  }
  return { ...state, dead: [...dead].sort((a, b) => a - b) };
}

/** Both players agree on the dead stones: compute the result and finish. */
export function finishScoring(state: GameState): GameState {
  if (state.status !== "scoring") return state;
  const s = score(state);
  return {
    ...state,
    status: "finished",
    result: { winner: s.winner, margin: s.margin, reason: "score" },
  };
}

/** Players disagree on the dead stones: go back to play. */
export function resumePlay(state: GameState): GameState {
  if (state.status !== "scoring") return state;
  return { ...state, status: "playing", consecutivePasses: 0, dead: [] };
}

/** The player whose clock ran out loses. */
export function timeout(state: GameState, loser: Color): GameState {
  if (state.status === "finished") return state;
  return {
    ...state,
    status: "finished",
    result: { winner: opponent(loser), margin: 0, reason: "timeout" },
  };
}

export { BLACK, WHITE };
