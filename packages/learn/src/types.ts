import type { Color } from "@playgolite/engine";

export type Point = readonly [x: number, y: number];

/**
 * What the player must achieve.
 * capture: remove the opposing stone (and its group) standing at `at`.
 * save: keep your own stone at `at` from being captured.
 */
export type Goal =
  | { type: "capture"; at: Point }
  | { type: "save"; at: Point };

export type PuzzleCategory =
  | "Capture"
  | "Capture a group"
  | "Two moves to capture"
  | "Escape"
  | "Connect";

export interface Puzzle {
  id: string;
  title: string;
  category: PuzzleCategory;
  /** 1 (easiest) to 5. */
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** The side the player controls, and who moves first. */
  toPlay: Color;
  /**
   * Top-left part of the board, "X" black, "O" white, "." empty.
   * Padded with empty points to `size` x `size`.
   */
  rows: string[];
  size?: number;
  goal: Goal;
  /** How many of the player's moves the solver may use to reach the goal. */
  depth: number;
  /** Candidate area [x0, y0, x1, y1], inclusive. Moves outside are ignored by the solver. */
  region: readonly [number, number, number, number];
  hint: string;
  /** Every first move that works, verified by the solver in tests. */
  answers: Point[];
}

export type Task =
  | { type: "info" }
  | { type: "play-any" }
  | { type: "play-at"; points: Point[] }
  | { type: "capture" }
  | { type: "atari" }
  /** The player tries a point that the rules reject; passes when the reason matches. */
  | { type: "illegal"; points: Point[]; reason: "suicide" | "ko" | "occupied" }
  /** Multiple choice. `answerFrom` computes the right answer from the board. */
  | {
      type: "choice";
      question: string;
      options: string[];
      /** Index of the right option. */
      answer: number;
      /** If set, tests check that the right option equals the liberty count of the group here. */
      liberties?: Point;
    }
  | {
      type: "count";
      question: string;
      /** Which total the player should find, computed by the engine. */
      measure: "blackArea" | "whiteArea" | "blackTerritory" | "whiteTerritory";
    };

export interface LessonStep {
  title?: string;
  text: string;
  board?: {
    rows: string[];
    size?: number;
    toPlay: Color;
    /** Moves played automatically, starting with `toPlay`, to reach the starting position (for example, the first half of a ko). */
    preMoves?: Point[];
    /** Optional crop [x0, y0, x1, y1] to zoom in. */
    crop?: readonly [number, number, number, number];
    /** Points to highlight with a ring. */
    marks?: Point[];
  };
  task: Task;
  hint?: string;
  success: string;
}

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: LessonStep[];
}
