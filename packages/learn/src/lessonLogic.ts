import {
  boardFromAscii,
  createFromBoard,
  groupAt,
  idx,
  illegalReason,
  neighborsFor,
  opponent,
  play,
  playOrThrow,
  score,
  type GameState,
  type IllegalReason,
} from "@playgolite/engine";
import type { LessonStep, Task } from "./types";

export const REASON_TEXT: Record<IllegalReason, string> = {
  "game-over": "The game is over.",
  "out-of-bounds": "That point is off the board.",
  occupied: "That point is taken.",
  suicide: "Not allowed: that stone would have no liberties.",
  ko: "Not allowed: that would repeat the earlier position (ko).",
};

/** Starting position of a lesson step, or null for steps without a board. */
export function lessonStepState(step: LessonStep): GameState | null {
  const b = step.board;
  if (!b) return null;
  const { size, board } = boardFromAscii(b.rows);
  let state = createFromBoard(size, board, b.toPlay, 0);
  for (const [x, y] of b.preMoves ?? []) state = playOrThrow(state, x, y);
  return state;
}

export type MoveEvaluation =
  | { kind: "success"; state: GameState }
  | { kind: "retry"; message: string };

function inPoints(points: ReadonlyArray<readonly [number, number]>, x: number, y: number): boolean {
  return points.some(([px, py]) => px === x && py === y);
}

/** After the player's move, is some enemy group next to it left with exactly one liberty? */
export function createsAtari(state: GameState, x: number, y: number): boolean {
  const me = state.board[idx(state.size, x, y)];
  if (me !== 1 && me !== 2) return false;
  const foe = opponent(me);
  for (const n of neighborsFor(state.size)[idx(state.size, x, y)] as number[]) {
    if (state.board[n] === foe && groupAt(state.board, state.size, n).liberties.length === 1) return true;
  }
  return false;
}

/** Judge a tap on the board for lesson steps that ask the player to make a move. */
export function evaluateLessonMove(step: LessonStep, state: GameState, x: number, y: number): MoveEvaluation {
  const task: Task = step.task;
  const hint = step.hint;

  if (task.type === "illegal") {
    if (!inPoints(task.points, x, y)) {
      return { kind: "retry", message: hint ?? "Try the marked point." };
    }
    const reason = illegalReason(state, x, y);
    if (reason === task.reason) return { kind: "success", state };
    return { kind: "retry", message: hint ?? "That move is allowed. Try the marked point." };
  }

  if (task.type === "play-at" && !inPoints(task.points, x, y)) {
    return { kind: "retry", message: hint ?? "Not that point. Look at the highlighted crossing." };
  }

  const r = play(state, { kind: "play", x, y });
  if (!r.ok) return { kind: "retry", message: REASON_TEXT[r.reason] };
  const next = r.state;

  switch (task.type) {
    case "play-any":
    case "play-at":
      return { kind: "success", state: next };
    case "capture":
      return next.captures.black + next.captures.white > state.captures.black + state.captures.white
        ? { kind: "success", state: next }
        : { kind: "retry", message: hint ?? "That did not capture anything. Look for a stone with one liberty left." };
    case "atari":
      return createsAtari(next, x, y)
        ? { kind: "success", state: next }
        : { kind: "retry", message: hint ?? "That does not leave exactly one liberty. Try another point." };
    default:
      return { kind: "retry", message: "Nothing to play on this step." };
  }
}

export type CountMeasure = Extract<Task, { type: "count" }>["measure"];

/** The correct number for a count task, computed by the engine. */
export function countAnswer(state: GameState, measure: CountMeasure): number {
  const s = score(state);
  if (measure === "blackArea") return s.blackArea;
  if (measure === "whiteArea") return s.whiteArea;
  const color = measure === "blackTerritory" ? 1 : 2;
  let n = 0;
  for (let i = 0; i < state.board.length; i++) {
    if (state.board[i] === 0 && s.owner[i] === color) n++;
  }
  return n;
}

/** Three sorted options that contain the right answer. Deterministic. */
export function countOptions(answer: number): number[] {
  return [answer - 3, answer, answer + 2].map((n) => Math.max(0, n)).filter((n, i, a) => a.indexOf(n) === i).sort((a, b) => a - b);
}
