import { FastBoard } from "./fastboard";
import { makeRng, playout, type Rng } from "./playout";

const PASS = -1;

class Node {
  readonly move: number;
  readonly parent: Node | null;
  /** The color that played `move` to reach this node. */
  readonly mover: number;
  children: Node[] = [];
  untried: number[] | null = null;
  visits = 0;
  wins = 0;

  constructor(move: number, parent: Node | null, mover: number) {
    this.move = move;
    this.parent = parent;
    this.mover = mover;
  }
}

export interface SearchOptions {
  /** Stop after this many playouts. */
  playouts: number;
  /** Stop after this many milliseconds. */
  timeMs: number;
  komi: number;
  rng?: Rng;
  /** UCT exploration constant. */
  explore?: number;
  /** Whether passing may be considered at the root. Default true. */
  allowPass?: boolean;
}

export interface SearchResult {
  /** Candidate moves sorted by visits, best first. -1 means pass. */
  ranked: Array<{ move: number; visits: number; winRate: number }>;
  playouts: number;
}

const now = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** Points worth considering: near existing stones, or the star points on an empty board. */
function candidatePoints(b: FastBoard, color: number): number[] {
  const out: number[] = [];
  const size = b.size;
  let stones = 0;
  for (let p = 0; p < b.n; p++) if (b.cells[p] !== 0) stones++;
  if (stones === 0) {
    const lo = size >= 13 ? 3 : 2;
    const hi = size - 1 - lo;
    const mid = (size - 1) / 2;
    for (const x of [lo, mid, hi]) for (const y of [lo, mid, hi]) out.push(y * size + x);
    return out;
  }
  const near = new Uint8Array(b.n);
  const radius = size <= 9 ? 3 : 2;
  for (let p = 0; p < b.n; p++) {
    if (b.cells[p] === 0) continue;
    const px = p % size;
    const py = (p - px) / size;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > radius + 1) continue;
        const x = px + dx;
        const y = py + dy;
        if (x >= 0 && y >= 0 && x < size && y < size) near[y * size + x] = 1;
      }
    }
  }
  for (let p = 0; p < b.n; p++) {
    if (b.cells[p] === 0 && near[p] === 1 && !b.isOwnEye(p, color)) out.push(p);
  }
  return out;
}


/** Sort so the most tactically promising moves are at the end of the list (tried first). */
function orderTactically(b: FastBoard, color: number, list: number[]): Map<number, number> {
  const foe = 3 - color;
  const score = new Map<number, number>();
  for (const p of list) {
    let wasInAtari = false;
    for (const nb of b.neighbors(p)) {
      if (b.cells[nb] === color && b.libsOf(nb) === 1) wasInAtari = true;
    }
    const t = b.clone();
    const captured = t.play(p, color);
    if (captured < 0) {
      score.set(p, -100);
      continue;
    }
    const libs = t.libsOf(p);
    let atari = 0;
    for (const nb of t.neighbors(p)) if (t.cells[nb] === foe && t.libsOf(nb) === 1) atari++;
    let v = captured * 5 + atari * 2;
    if (wasInAtari && libs >= 2) v += 4;
    if (libs === 1 && captured === 0) v -= 6;
    score.set(p, v);
  }
  list.sort((a, c) => (score.get(a) as number) - (score.get(c) as number));
  return score;
}

function shuffle(a: number[], rng: Rng): void {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = a[i] as number;
    a[i] = a[j] as number;
    a[j] = t;
  }
}

/**
 * Monte Carlo tree search (UCT) from `board` with `toPlay` to move.
 * `passes` is how many consecutive passes just happened (0 or 1).
 */
export function search(board: FastBoard, toPlay: number, passes: number, opts: SearchOptions): SearchResult {
  const rng = opts.rng ?? makeRng();
  const c = opts.explore ?? 0.9;
  const root = new Node(-2, null, 3 - toPlay);
  let rootBias = new Map<number, number>();
  const deadline = now() + opts.timeMs;
  let playouts = 0;

  while (playouts < opts.playouts) {
    if ((playouts & 15) === 0 && now() > deadline) break;
    const b = board.clone();
    let node = root;
    let color = toPlay;
    let passCount = passes;
    let last = -1;
    let terminal = false;

    // Selection and expansion.
    for (;;) {
      if (node.untried === null) {
        const list = candidatePoints(b, color);
        shuffle(list, rng);
        // At the root, try tactical moves (captures, ataris, escapes) first.
        if (node === root) rootBias = orderTactically(b, color, list);
        // Passing is only considered at the root, where it matters for ending the game.
        if (node === root && opts.allowPass !== false) list.push(PASS);
        node.untried = list;
      }
      if (node.untried.length > 0) {
        let child: Node | null = null;
        while (node.untried.length > 0 && !child) {
          const mv = node.untried.pop() as number;
          if (mv === PASS) {
            child = new Node(PASS, node, color);
            passCount++;
            b.ko = -1;
            last = -1;
          } else if (b.play(mv, color) >= 0) {
            child = new Node(mv, node, color);
            passCount = 0;
            last = mv;
            if (node === root) {
              // Prior knowledge: start tactical moves with a few virtual results.
              const v = rootBias.get(mv) ?? 0;
              if (v >= 5) {
                child.visits = 8;
                child.wins = 7;
              } else if (v >= 2) {
                child.visits = 4;
                child.wins = 3;
              } else if (v <= -6) {
                child.visits = 4;
              }
            }
          }
        }
        if (child) {
          node.children.push(child);
          node = child;
          color = 3 - color;
        }
        break;
      }
      if (node.children.length === 0) break;
      // Pick the child with the best UCT value.
      let best: Node | null = null;
      let bestScore = -Infinity;
      const logN = Math.log(node.visits + 1);
      for (const ch of node.children) {
        const s = ch.wins / (ch.visits + 1e-9) + c * Math.sqrt(logN / (ch.visits + 1e-9));
        if (s > bestScore) {
          bestScore = s;
          best = ch;
        }
      }
      if (!best) break;
      if (best.move === PASS) {
        passCount++;
        b.ko = -1;
        last = -1;
      } else {
        if (b.play(best.move, color) < 0) {
          // A ko or ordering difference made this move illegal here. Drop it.
          node.children.splice(node.children.indexOf(best), 1);
          if (node.children.length === 0) break;
          continue;
        }
        passCount = 0;
        last = best.move;
      }
      node = best;
      color = 3 - color;
    }

    if (passCount >= 2) terminal = true;

    // Simulation.
    const diff = terminal ? b.areaDiff() : playout(b, color, last, passCount, rng);
    const blackWins = diff - opts.komi > 0;

    // Backpropagation: wins are counted for the side that moved into each node.
    for (let nd: Node | null = node; nd !== null; nd = nd.parent) {
      nd.visits++;
      if (nd.move !== -2) {
        const moverIsBlack = nd.mover === 1;
        if (moverIsBlack === blackWins) nd.wins++;
      }
    }
    playouts++;
  }

  const ranked = root.children
    .map((ch) => ({ move: ch.move, visits: ch.visits, winRate: ch.visits > 0 ? ch.wins / ch.visits : 0 }))
    .sort((a, b) => b.visits - a.visits);
  return { ranked, playouts };
}
