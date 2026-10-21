import { groupAt, idx, isLegal, type GameState, type Move } from "@playgolite/engine";
import { FastBoard } from "./fastboard";
import { search } from "./mcts";
import { makeRng, playout, type Rng } from "./playout";

export type Level = "beginner" | "easy" | "medium" | "hard" | "expert" | "master";

export const LEVELS: ReadonlyArray<{ id: Level; label: string; blurb: string }> = [
  { id: "beginner", label: "Beginner", blurb: "Plays mostly at random" },
  { id: "easy", label: "Easy", blurb: "Sees captures and ataris" },
  { id: "medium", label: "Medium", blurb: "Looks a little ahead" },
  { id: "hard", label: "Hard", blurb: "Thinks for a few seconds" },
  { id: "expert", label: "Expert", blurb: "Uses all the time it can" },
  { id: "master", label: "Master", blurb: "Neural network. One-time download" },
];

/** Search budgets for the stronger levels. The time limit makes strength depend on the device. */
const BUDGET: Record<"medium" | "hard" | "expert", { playouts: number; timeMs: number }> = {
  medium: { playouts: 2500, timeMs: 1500 },
  hard: { playouts: 12000, timeMs: 4000 },
  expert: { playouts: 80000, timeMs: 9000 },
};

export interface ChooseOptions {
  rng?: Rng;
  /** Multiplies the search budget. Tests use a small value to stay fast. */
  budgetScale?: number;
}

export interface Choice {
  move: Move;
  /** Estimated chance the computer wins, for the search levels. */
  winRate?: number;
}

const PASS: Move = { kind: "pass" };

function lastWasPass(state: GameState): boolean {
  const m = state.moves[state.moves.length - 1];
  return m?.move.kind === "pass";
}

/** From the computer's point of view, is it ahead on the board right now (area, with komi)? */
function aheadNow(state: GameState, fb: FastBoard): boolean {
  const diff = fb.areaDiff() - state.komi; // positive means Black ahead
  return state.toPlay === 1 ? diff > 0 : diff < 0;
}

function toXY(size: number, p: number): { x: number; y: number } {
  return { x: p % size, y: Math.floor(p / size) };
}

/** Is the point p legal for the player to move under the real rules (including superko)? */
function legalPoint(state: GameState, p: number): boolean {
  const { x, y } = toXY(state.size, p);
  return isLegal(state, x, y);
}

function playMove(state: GameState, p: number): Move {
  const { x, y } = toXY(state.size, p);
  return { kind: "play", x, y };
}

function beginnerMove(state: GameState, fb: FastBoard, rng: Rng): Move {
  const color = state.toPlay;
  const points: number[] = [];
  for (let p = 0; p < fb.n; p++) {
    if (fb.cells[p] === 0 && !fb.isOwnEye(p, color)) points.push(p);
  }
  for (let i = points.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = points[i] as number;
    points[i] = points[j] as number;
    points[j] = t;
  }
  for (const p of points) if (legalPoint(state, p)) return playMove(state, p);
  return PASS;
}

/** One move of look-ahead using simple tactical scores, plus noise so it does not repeat itself. */
function easyMove(state: GameState, fb: FastBoard, rng: Rng): Move {
  const color = state.toPlay;
  const foe = 3 - color;
  let best = -Infinity;
  let bestP = -1;
  for (let p = 0; p < fb.n; p++) {
    if (fb.cells[p] !== 0 || fb.isOwnEye(p, color)) continue;
    // Which of my groups are in atari right now next to this point?
    let wasInAtari = false;
    for (const nb of fb.neighbors(p)) {
      if (fb.cells[nb] === color && fb.libsOf(nb) === 1) wasInAtari = true;
    }
    const t = fb.clone();
    const captured = t.play(p, color);
    if (captured < 0) continue;
    const myLibs = t.libsOf(p);
    let atari = 0;
    for (const nb of t.neighbors(p)) {
      if (t.cells[nb] === foe && t.libsOf(nb) === 1) atari++;
    }
    let score = captured * 10 + atari * 4;
    if (wasInAtari && myLibs >= 2) score += 8;
    if (myLibs === 1 && captured === 0) score -= 12; // self-atari
    // Mild preference for the middle of the board and for staying near the action.
    const x = p % fb.size;
    const y = (p - x) / fb.size;
    const edge = Math.min(x, y, fb.size - 1 - x, fb.size - 1 - y);
    score += Math.min(edge, 3) * 0.6;
    score += rng() * 3;
    if (score > best && legalPoint(state, p)) {
      best = score;
      bestP = p;
    }
  }
  return bestP >= 0 ? playMove(state, bestP) : PASS;
}

export function chooseMove(state: GameState, level: Level, opts: ChooseOptions = {}): Choice {
  if (state.status !== "playing") return { move: PASS };
  const rng = opts.rng ?? makeRng();
  const fb = FastBoard.fromState(state);
  const opponentPassed = lastWasPass(state);

  // If the opponent passed and we are already ahead, passing ends the game.
  let stones = 0;
  for (let p = 0; p < fb.n; p++) if (fb.cells[p] !== 0) stones++;
  const developed = stones >= fb.n / 4;
  if (opponentPassed && developed && aheadNow(state, fb)) return { move: PASS };
  // Do not let the search end the game early on a mostly empty board.
  const allowPass = developed && (opponentPassed || stones >= fb.n / 3);

  if (level === "beginner") return { move: beginnerMove(state, fb, rng) };
  if (level === "easy") return { move: easyMove(state, fb, rng) };

  // Master needs the downloaded network; without it the search plays at Expert strength.
  const budget = BUDGET[level === "master" ? "expert" : level];
  const scale = opts.budgetScale ?? 1;
  const result = search(fb, state.toPlay, opponentPassed ? 1 : 0, {
    playouts: Math.max(20, Math.round(budget.playouts * scale)),
    timeMs: Math.max(30, budget.timeMs * scale),
    komi: state.komi,
    rng,
    allowPass,
  });
  for (const c of result.ranked) {
    if (c.move === -1) return { move: PASS, winRate: c.winRate };
    if (legalPoint(state, c.move)) return { move: playMove(state, c.move), winRate: c.winRate };
  }
  return { move: PASS };
}

/**
 * Guess which stone groups are dead at the end of a game, by playing many random
 * games from the final position and seeing who ends up owning each point.
 * Returns one point index per group judged dead.
 */
export function estimateDeadGroups(state: GameState, playouts = 200, rng: Rng = makeRng()): number[] {
  const fb = FastBoard.fromState(state);
  const owned = new Float32Array(fb.n); // +1 per black ownership, -1 per white
  for (let i = 0; i < playouts; i++) {
    const b = fb.clone();
    playout(b, state.toPlay, -1, 0, rng);
    const o = b.owners();
    for (let p = 0; p < fb.n; p++) {
      if (o[p] === 1) owned[p] = (owned[p] as number) + 1;
      else if (o[p] === 2) owned[p] = (owned[p] as number) - 1;
    }
  }
  const dead: number[] = [];
  const seen = new Set<number>();
  for (let p = 0; p < fb.n; p++) {
    const c = state.board[p];
    if ((c !== 1 && c !== 2) || seen.has(p)) continue;
    const g = groupAt(state.board, state.size, p);
    for (const s of g.stones) seen.add(s);
    let sum = 0;
    for (const s of g.stones) sum += (owned[s] as number) * (c === 1 ? 1 : -1);
    const avg = sum / (g.stones.length * playouts);
    if (avg < -0.4) dead.push(p);
  }
  return dead;
}

export { idx };
