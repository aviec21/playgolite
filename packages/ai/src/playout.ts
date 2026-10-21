import { FastBoard } from "./fastboard";

export type Rng = () => number;

/** Small fast seeded generator (mulberry32). */
export function makeRng(seed = (Math.random() * 4294967296) >>> 0): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a playout move for `color`, or -1 to pass.
 * Policy: answer atari next to the last move (capture the enemy or save your
 * own stones), otherwise a random legal point that does not fill an own eye.
 */
export function playoutMove(b: FastBoard, color: number, last: number, rng: Rng): number {
  const foe = 3 - color;
  if (last >= 0) {
    for (const nb of b.neighbors(last)) {
      const c = b.cells[nb];
      if (c === foe) {
        if (b.libsOf(nb, 2) === 1) {
          const lib = findLiberty(b);
          if (lib >= 0 && !b.isOwnEye(lib, color) && tryPlay(b, lib, color)) return lib;
        }
      } else if (c === color) {
        if (b.libsOf(nb, 2) === 1) {
          const lib = findLiberty(b);
          if (lib >= 0 && !b.isOwnEye(lib, color)) {
            const backup = b.cells.slice();
            const ko = b.ko;
            if (b.play(lib, color) >= 0) {
              if (b.libsOf(lib, 2) >= 2) return lib;
              b.cells.set(backup);
              b.ko = ko;
            }
          }
        }
      }
    }
  }
  const n = b.n;
  const start = Math.floor(rng() * n);
  for (let i = 0; i < n; i++) {
    const p = start + i < n ? start + i : start + i - n;
    if (b.cells[p] !== 0) continue;
    if (b.isOwnEye(p, color)) continue;
    if (tryPlay(b, p, color)) return p;
  }
  return -1;
}

/** Play only if legal. Used by the policy so legality lives in one place. */
function tryPlay(b: FastBoard, p: number, color: number): boolean {
  return b.play(p, color) >= 0;
}

/** The single liberty of the group counted by the last libsOf call. */
function findLiberty(b: FastBoard): number {
  for (let i = 0; i < b.groupLen; i++) {
    for (const nb of b.neighbors(b.group[i] as number)) {
      if (b.cells[nb] === 0) return nb;
    }
  }
  return -1;
}

/**
 * Play random moves until both sides pass (or the cap is hit) and return
 * the area difference (black minus white) before komi.
 */
export function playout(b: FastBoard, toPlay: number, lastMove: number, passes: number, rng: Rng): number {
  let color = toPlay;
  let last = lastMove;
  let consecutive = passes;
  const cap = Math.floor(b.n * 1.5);
  for (let i = 0; i < cap && consecutive < 2; i++) {
    const p = playoutMove(b, color, last, rng);
    if (p < 0) {
      consecutive++;
      b.ko = -1;
      last = -1;
    } else {
      consecutive = 0;
      last = p;
    }
    color = 3 - color;
  }
  return b.areaDiff();
}
