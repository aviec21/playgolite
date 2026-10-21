import { groupAt, isLegal, type GameState, type Move } from "@playgolite/engine";
import { POS_LEN } from "./features";

export interface NetOutputs {
  /** 362 logits: 19 x 19 grid then pass. */
  policy: ArrayLike<number>;
  /** win, loss, no result logits for the player to move. */
  value: ArrayLike<number>;
  /** 19 x 19 ownership in [-1, 1], positive for the player to move. */
  ownership: ArrayLike<number>;
}

export interface PickOptions {
  /** 0 picks the top move. Higher values sample more widely. */
  temperature?: number;
  rng?: () => number;
}

/** Choose a legal move from the network's policy. */
export function pickNetMove(state: GameState, out: NetOutputs, opts: PickOptions = {}): Move {
  const size = state.size;
  const cands: Array<{ move: Move; logit: number }> = [];
  let stones = 0;
  for (let p = 0; p < size * size; p++) if (state.board[p] !== 0) stones++;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (isLegal(state, x, y)) cands.push({ move: { kind: "play", x, y }, logit: out.policy[y * POS_LEN + x] as number });
    }
  }
  // Do not pass in the opening, however the network's logits look.
  const passOk = cands.length === 0 || stones >= (size * size) / 6;
  if (passOk) cands.push({ move: { kind: "pass" }, logit: out.policy[POS_LEN * POS_LEN] as number });
  // Only pass when the network thinks the game is won; otherwise keep playing.
  const v0 = out.value[0] as number;
  const v1 = out.value[1] as number;
  const winProb = Math.exp(v0) / (Math.exp(v0) + Math.exp(v1) + Math.exp(out.value[2] as number));
  const lossProb = Math.exp(v1) / (Math.exp(v0) + Math.exp(v1) + Math.exp(out.value[2] as number));
  if (winProb < lossProb && cands.length > 1) {
    const idx = cands.findIndex((c) => c.move.kind === "pass");
    if (idx >= 0) cands.splice(idx, 1);
  }
  const t = opts.temperature ?? 0;
  if (t <= 0) return cands.reduce((a, b) => (b.logit > a.logit ? b : a)).move;
  const rng = opts.rng ?? Math.random;
  const mx = Math.max(...cands.map((c) => c.logit));
  const w = cands.map((c) => Math.exp((c.logit - mx) / t));
  let r = rng() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < cands.length; i++) {
    r -= w[i] as number;
    if (r <= 0) return (cands[i] as { move: Move }).move;
  }
  return (cands[0] as { move: Move }).move;
}

/**
 * Representative point of every stone group the network thinks is dead, from its ownership map.
 * A group is dead when most of its points belong to the other side.
 */
export function deadGroupsFromOwnership(state: GameState, ownership: ArrayLike<number>, threshold = 0.3): number[] {
  const size = state.size;
  const dead: number[] = [];
  const seen = new Set<number>();
  for (let p = 0; p < size * size; p++) {
    const c = state.board[p];
    if ((c !== 1 && c !== 2) || seen.has(p)) continue;
    const g = groupAt(state.board, size, p);
    for (const s of g.stones) seen.add(s);
    let sum = 0;
    for (const s of g.stones) {
      const own = ownership[Math.floor(s / size) * POS_LEN + (s % size)] as number;
      sum += Math.tanh(own);
    }
    const mean = sum / g.stones.length;
    // Positive ownership favours the player to move.
    const mine = c === state.toPlay;
    const favour = mine ? mean : -mean;
    if (favour < -threshold) dead.push(p);
  }
  return dead;
}
