import { neighborsFor, type Cell, type GameState } from "@playgolite/engine";

/**
 * A small mutable board built for speed in playouts. It uses the simple ko rule
 * (the real game applies superko through the rules engine when a move is chosen).
 * Colors: 0 empty, 1 black, 2 white.
 */
export class FastBoard {
  readonly size: number;
  readonly n: number;
  cells: Uint8Array;
  /** Point that cannot be played right now because of a simple ko, or -1. */
  ko = -1;
  private readonly nbrs: number[][];
  private readonly diags: number[][];
  private readonly sc: Scratch;
  /** Number of stones in the group found by the last call to libsOf. */
  groupLen = 0;

  /** Stones of the group found by the last call to libsOf. */
  get group(): Int32Array {
    return this.sc.group;
  }

  constructor(size: number, cells?: Uint8Array) {
    this.size = size;
    this.n = size * size;
    this.cells = cells ?? new Uint8Array(this.n);
    this.nbrs = neighborsFor(size);
    this.diags = diagonalsFor(size);
    this.sc = scratchFor(size);
  }

  static fromState(state: GameState): FastBoard {
    const b = new FastBoard(state.size, Uint8Array.from(state.board as readonly Cell[]));
    return b;
  }

  clone(): FastBoard {
    const b = new FastBoard(this.size, this.cells.slice());
    b.ko = this.ko;
    return b;
  }

  neighbors(p: number): number[] {
    return this.nbrs[p] as number[];
  }

  /**
   * Count liberties of the group at p and fill `group` / `groupLen`.
   * With `stopAt`, counting stops as soon as that many liberties are found; the
   * group buffer is then incomplete, but the returned count (>= stopAt) is exact enough
   * to answer "does it have at least that many?". Below `stopAt` the result is complete.
   */
  libsOf(p: number, stopAt = 1 << 30): number {
    const color = this.cells[p] as number;
    const st = ++this.sc.stamp;
    let top = 0;
    let len = 0;
    let libs = 0;
    this.sc.stack[top++] = p;
    this.sc.seen[p] = st;
    while (top > 0) {
      const q = this.sc.stack[--top] as number;
      this.sc.group[len++] = q;
      for (const nb of this.nbrs[q] as number[]) {
        const c = this.cells[nb] as number;
        if (c === 0) {
          if (this.sc.libSeen[nb] !== st) {
            this.sc.libSeen[nb] = st;
            libs++;
            if (libs >= stopAt) {
              this.groupLen = len;
              return libs;
            }
          }
        } else if (c === color && this.sc.seen[nb] !== st) {
          this.sc.seen[nb] = st;
          this.sc.stack[top++] = nb;
        }
      }
    }
    this.groupLen = len;
    return libs;
  }

  /**
   * Try to play. Returns the number of stones captured, or -1 if the move is not
   * legal (occupied, simple ko, or suicide). The board is unchanged on failure.
   */
  play(p: number, color: number): number {
    if (this.cells[p] !== 0 || p === this.ko) return -1;
    const foe = 3 - color;
    this.cells[p] = color;
    let captured = 0;
    let lastSingle = -1;
    for (const nb of this.nbrs[p] as number[]) {
      if (this.cells[nb] === foe && this.libsOf(nb, 1) === 0) {
        for (let i = 0; i < this.groupLen; i++) this.cells[this.sc.group[i] as number] = 0;
        if (this.groupLen === 1) lastSingle = nb;
        captured += this.groupLen;
      }
    }
    const libs = this.libsOf(p, 2);
    if (libs === 0) {
      this.cells[p] = 0;
      return -1;
    }
    this.ko = captured === 1 && this.groupLen === 1 && libs === 1 ? lastSingle : -1;
    return captured;
  }

  /** Is p an empty point surrounded by `color` that the player should not fill? */
  isOwnEye(p: number, color: number): boolean {
    if (this.cells[p] !== 0) return false;
    const nb = this.nbrs[p] as number[];
    for (const q of nb) if (this.cells[q] !== color) return false;
    const foe = 3 - color;
    const dg = this.diags[p] as number[];
    let foeDiag = 0;
    for (const q of dg) if (this.cells[q] === foe) foeDiag++;
    // On the edge or in a corner (fewer than 4 diagonals) one enemy diagonal ruins the eye.
    return dg.length < 4 ? foeDiag === 0 : foeDiag < 2;
  }

  /** Area score: stones plus empty regions touching only one color. Returns black minus white. */
  areaDiff(): number {
    const st = ++this.sc.stamp;
    let black = 0;
    let white = 0;
    for (let p = 0; p < this.n; p++) {
      const c = this.cells[p] as number;
      if (c === 1) black++;
      else if (c === 2) white++;
    }
    for (let p = 0; p < this.n; p++) {
      if (this.cells[p] !== 0 || this.sc.seen[p] === st) continue;
      let top = 0;
      let size = 0;
      let touchB = false;
      let touchW = false;
      this.sc.stack[top++] = p;
      this.sc.seen[p] = st;
      while (top > 0) {
        const q = this.sc.stack[--top] as number;
        size++;
        for (const nb of this.nbrs[q] as number[]) {
          const c = this.cells[nb] as number;
          if (c === 0) {
            if (this.sc.seen[nb] !== st) {
              this.sc.seen[nb] = st;
              this.sc.stack[top++] = nb;
            }
          } else if (c === 1) touchB = true;
          else touchW = true;
        }
      }
      if (touchB && !touchW) black += size;
      else if (touchW && !touchB) white += size;
    }
    return black - white;
  }

  /** Owner of every point under area scoring: 1, 2 or 0 (neutral). */
  owners(): Uint8Array {
    const out = new Uint8Array(this.n);
    const st = ++this.sc.stamp;
    for (let p = 0; p < this.n; p++) {
      const c = this.cells[p] as number;
      if (c !== 0) out[p] = c;
    }
    const region: number[] = [];
    for (let p = 0; p < this.n; p++) {
      if (this.cells[p] !== 0 || this.sc.seen[p] === st) continue;
      region.length = 0;
      let top = 0;
      let touchB = false;
      let touchW = false;
      this.sc.stack[top++] = p;
      this.sc.seen[p] = st;
      while (top > 0) {
        const q = this.sc.stack[--top] as number;
        region.push(q);
        for (const nb of this.nbrs[q] as number[]) {
          const c = this.cells[nb] as number;
          if (c === 0) {
            if (this.sc.seen[nb] !== st) {
              this.sc.seen[nb] = st;
              this.sc.stack[top++] = nb;
            }
          } else if (c === 1) touchB = true;
          else touchW = true;
        }
      }
      const o = touchB && !touchW ? 1 : touchW && !touchB ? 2 : 0;
      if (o !== 0) for (const q of region) out[q] = o;
    }
    return out;
  }
}

const diagCache = new Map<number, number[][]>();

function diagonalsFor(size: number): number[][] {
  const cached = diagCache.get(size);
  if (cached) return cached;
  const table: number[][] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const list: number[] = [];
      for (const dy of [-1, 1]) {
        for (const dx of [-1, 1]) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < size && ny < size) list.push(ny * size + nx);
        }
      }
      table.push(list);
    }
  }
  diagCache.set(size, table);
  return table;
}

/**
 * Work buffers shared by every board of the same size. The search is single
 * threaded, so sharing them avoids allocating five arrays per board copy.
 */
interface Scratch {
  seen: Int32Array;
  libSeen: Int32Array;
  stack: Int32Array;
  group: Int32Array;
  stamp: number;
}

const scratchCache = new Map<number, Scratch>();

function scratchFor(size: number): Scratch {
  let sc = scratchCache.get(size);
  if (!sc) {
    const n = size * size;
    sc = { seen: new Int32Array(n), libSeen: new Int32Array(n), stack: new Int32Array(n), group: new Int32Array(n), stamp: 0 };
    scratchCache.set(size, sc);
  }
  return sc;
}
