import { neighborsFor } from "./board";
import type { Cell, Color, GameState, ScoreResult } from "./types";

/**
 * Area (Chinese) scoring: each side counts its stones plus empty regions that
 * touch only that color. Stones in `dead` are removed first. Komi goes to white.
 */
export function score(
  state: Pick<GameState, "size" | "board" | "komi" | "dead">,
  deadOverride?: readonly number[],
): ScoreResult {
  const size = state.size;
  const board = state.board.slice() as Cell[];
  for (const d of deadOverride ?? state.dead) board[d] = 0;

  const nbrs = neighborsFor(size);
  const owner: Cell[] = new Array<Cell>(board.length).fill(0);
  const seen = new Array<boolean>(board.length).fill(false);

  for (let i = 0; i < board.length; i++) {
    const c = board[i] as Cell;
    if (c !== 0) {
      owner[i] = c;
      continue;
    }
    if (seen[i]) continue;
    // Flood this empty region and record which colors border it.
    const region: number[] = [];
    const borders = new Set<Color>();
    const stack = [i];
    seen[i] = true;
    while (stack.length > 0) {
      const p = stack.pop() as number;
      region.push(p);
      for (const n of nbrs[p] as number[]) {
        const nc = board[n] as Cell;
        if (nc === 0) {
          if (!seen[n]) {
            seen[n] = true;
            stack.push(n);
          }
        } else {
          borders.add(nc);
        }
      }
    }
    if (borders.size === 1) {
      const only = [...borders][0] as Color;
      for (const p of region) owner[p] = only;
    }
  }

  let blackArea = 0;
  let whiteArea = 0;
  for (const o of owner) {
    if (o === 1) blackArea++;
    else if (o === 2) whiteArea++;
  }
  const blackScore = blackArea;
  const whiteScore = whiteArea + state.komi;
  const diff = blackScore - whiteScore;
  return {
    blackArea,
    whiteArea,
    komi: state.komi,
    blackScore,
    whiteScore,
    winner: diff > 0 ? 1 : diff < 0 ? 2 : null,
    margin: Math.abs(diff),
    owner,
  };
}
