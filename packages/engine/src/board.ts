import type { Cell } from "./types";

const neighborCache = new Map<number, number[][]>();

/** Neighbor indices for every point of a size x size board (cached). */
export function neighborsFor(size: number): number[][] {
  const cached = neighborCache.get(size);
  if (cached) return cached;
  const table: number[][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const list: number[] = [];
      if (y > 0) list.push((y - 1) * size + x);
      if (x > 0) list.push(y * size + x - 1);
      if (x < size - 1) list.push(y * size + x + 1);
      if (y < size - 1) list.push((y + 1) * size + x);
      table.push(list);
    }
  }
  neighborCache.set(size, table);
  return table;
}

export interface Group {
  stones: number[];
  liberties: number[];
}

/** Flood fill the group containing the stone at `start`. */
export function groupAt(
  board: readonly Cell[],
  size: number,
  start: number,
): Group {
  const color = board[start];
  const nbrs = neighborsFor(size);
  const stones: number[] = [];
  const libs = new Set<number>();
  if (color === 0 || color === undefined) return { stones, liberties: [] };
  const visited = new Set<number>([start]);
  const stack = [start];
  while (stack.length > 0) {
    const p = stack.pop() as number;
    stones.push(p);
    for (const n of nbrs[p] as number[]) {
      const c = board[n];
      if (c === 0) libs.add(n);
      else if (c === color && !visited.has(n)) {
        visited.add(n);
        stack.push(n);
      }
    }
  }
  return { stones, liberties: [...libs] };
}

// Zobrist hashing with a deterministic PRNG so hashes are stable everywhere.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MAX_POINTS = 25 * 25;
const zA = new Uint32Array(MAX_POINTS * 2);
const zB = new Uint32Array(MAX_POINTS * 2);
{
  const rng = mulberry32(0x9051);
  for (let i = 0; i < zA.length; i++) {
    zA[i] = Math.floor(rng() * 4294967296) >>> 0;
    zB[i] = Math.floor(rng() * 4294967296) >>> 0;
  }
}

/** Positional hash of a board. Two 32-bit lanes, joined as a string key. */
export function hashBoard(board: readonly Cell[]): string {
  let a = 0;
  let b = 0;
  for (let i = 0; i < board.length; i++) {
    const c = board[i];
    if (c === 0 || c === undefined) continue;
    const k = i * 2 + (c - 1);
    a ^= zA[k] as number;
    b ^= zB[k] as number;
  }
  return `${a >>> 0}:${b >>> 0}`;
}
