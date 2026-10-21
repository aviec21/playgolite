export * from "./types";
export {
  padRows,
  puzzleSize,
  puzzleStart,
  winningMoves,
  refutation,
  bestDefense,
  playerMoveWins,
  goalStatus,
} from "./solver";
export { PUZZLES, BASE_PUZZLES, PUZZLE_CATEGORIES } from "./puzzles";
export { LESSONS } from "./lessons";
export {
  REASON_TEXT,
  lessonStepState,
  evaluateLessonMove,
  createsAtari,
  countAnswer,
  countOptions,
} from "./lessonLogic";
export type { MoveEvaluation, CountMeasure } from "./lessonLogic";
