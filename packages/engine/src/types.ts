export const EMPTY = 0 as const;
export const BLACK = 1 as const;
export const WHITE = 2 as const;

export type Color = typeof BLACK | typeof WHITE;
export type Cell = typeof EMPTY | Color;

export type Move =
  | { kind: "play"; x: number; y: number }
  | { kind: "pass" }
  | { kind: "resign" };

export type IllegalReason =
  | "game-over"
  | "out-of-bounds"
  | "occupied"
  | "suicide"
  | "ko";

export type GameStatus = "playing" | "scoring" | "finished";

export interface GameResult {
  winner: Color | null;
  /** Points margin. 0 for resignation. */
  margin: number;
  reason: "score" | "resign" | "timeout";
}

export interface MoveRecord {
  color: Color;
  move: Move;
  /** Number of stones captured by this move. */
  captured: number;
}

export interface GameState {
  readonly size: number;
  readonly komi: number;
  /** Row-major, index = y * size + x. */
  readonly board: readonly Cell[];
  readonly toPlay: Color;
  /** Stones captured BY each color. */
  readonly captures: { readonly black: number; readonly white: number };
  /** Hash of the current board (positional, ignores who is to move). */
  readonly hash: string;
  /** Every board position that has occurred, for the positional superko rule. */
  readonly seen: readonly string[];
  readonly moves: readonly MoveRecord[];
  readonly consecutivePasses: number;
  readonly status: GameStatus;
  /** Point indices of stones currently marked dead during the scoring phase. */
  readonly dead: readonly number[];
  readonly result?: GameResult;
}

export type PlayResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: IllegalReason };

export interface ScoreResult {
  blackArea: number;
  whiteArea: number;
  komi: number;
  blackScore: number;
  whiteScore: number;
  winner: Color | null;
  margin: number;
  /** Per point owner after removing dead stones: 0 = neutral. */
  owner: Cell[];
}

export function opponent(c: Color): Color {
  return c === BLACK ? WHITE : BLACK;
}
