import { neighborsFor, illegalReason, type Cell, type GameState } from "@playgolite/engine";

/**
 * Builds the inputs for KataGo's network (22 board planes and 19 global values) from a game.
 * This follows KataGo's reference python code (python/katago/game/features.py) for the rules
 * we use: area scoring, positional superko, suicide illegal.
 *
 * Planes: 0 on board, 1 own stones, 2 enemy stones, 3 to 5 groups with 1, 2, 3 liberties,
 * 6 ko-banned points, 9 to 13 the last five moves, 14 to 17 ladder planes (left empty here),
 * 18 and 19 area owned by us and by the enemy.
 */
export const POS_LEN = 19;
export const NUM_SPATIAL = 22;
export const NUM_GLOBAL = 19;

export interface PastMove {
  /** 1 Black, 2 White. */
  color: number;
  /** Point index (y * size + x), or -1 for a pass. */
  point: number;
}

export interface FeatureInput {
  size: number;
  board: ArrayLike<number>;
  /** 1 Black, 2 White. */
  toPlay: number;
  /** White's komi. */
  komi: number;
  /** Oldest first. Only the last five matter. */
  history: PastMove[];
  /** Empty points that may not be played because of ko. */
  koPoints: number[];
}

export interface NetInputs {
  /** NCHW with N = 1, length 22 * 19 * 19. */
  spatial: Float32Array;
  global: Float32Array;
}

/** Libertiy count of the group containing each stone, and the group id of each stone. */
function analyseGroups(size: number, board: ArrayLike<number>, nbrs: number[][]) {
  const n = size * size;
  const groupId = new Int32Array(n).fill(-1);
  const groups: Array<{ color: number; stones: number[]; libs: number }> = [];
  const libMark = new Int32Array(n).fill(-1);
  for (let p = 0; p < n; p++) {
    const c = board[p] as number;
    if (c === 0 || groupId[p] !== -1) continue;
    const id = groups.length;
    const stones = [p];
    groupId[p] = id;
    let libs = 0;
    for (let i = 0; i < stones.length; i++) {
      for (const q of nbrs[stones[i] as number] as number[]) {
        const qc = board[q] as number;
        if (qc === 0) {
          if (libMark[q] !== id) {
            libMark[q] = id;
            libs++;
          }
        } else if (qc === c && groupId[q] === -1) {
          groupId[q] = id;
          stones.push(q);
        }
      }
    }
    groups.push({ color: c, stones, libs });
  }
  return { groupId, groups };
}

/**
 * KataGo's "area" for one colour: pass-alive groups (Benson's algorithm) plus the empty regions
 * they surround. With `unsafeBig` any empty region that contains no enemy stone and touches a
 * stone of this colour counts too. Writes the colour into `result` for every point it owns.
 */
function areaForColor(
  size: number,
  board: ArrayLike<number>,
  nbrs: number[][],
  groupId: Int32Array,
  groups: Array<{ color: number; stones: number[]; libs: number }>,
  pla: number,
  result: Uint8Array,
): void {
  const n = size * size;
  const opp = 3 - pla;
  const regionOf = new Int32Array(n).fill(-1);
  interface Region {
    locs: number[];
    vital: number[]; // ids of own groups this region is vital for
    internal: number; // capped at 2
    containsOpp: boolean;
    bordersDead: boolean;
  }
  const regions: Region[] = [];
  let atLeastOnePla = false;

  for (let start = 0; start < n; start++) {
    const c = board[start] as number;
    if (c === pla) atLeastOnePla = true;
    if (c !== 0 || regionOf[start] !== -1) continue;
    const idr = regions.length;
    const reg: Region = { locs: [], vital: [], internal: 0, containsOpp: false, bordersDead: false };
    // Initial vital set: own groups adjacent to the first (empty) point.
    for (const q of nbrs[start] as number[]) {
      if (board[q] === pla) {
        const g = groupId[q] as number;
        if (!reg.vital.includes(g)) reg.vital.push(g);
      }
    }
    regionOf[start] = idr;
    const stack = [start];
    while (stack.length > 0) {
      const p = stack.pop() as number;
      reg.locs.push(p);
      const pc = board[p] as number;
      if (pc === 0) {
        // Only genuinely empty points can rule out vital groups (suicide is illegal here).
        reg.vital = reg.vital.filter((g) =>
          (nbrs[p] as number[]).some((q) => board[q] === pla && groupId[q] === g),
        );
      }
      if (reg.internal < 2 && !(nbrs[p] as number[]).some((q) => board[q] === pla)) reg.internal++;
      if (pc === opp) reg.containsOpp = true;
      for (const q of nbrs[p] as number[]) {
        const qc = board[q] as number;
        if ((qc === 0 || qc === opp) && regionOf[q] === -1) {
          regionOf[q] = idr;
          stack.push(q);
        }
      }
    }
    regions.push(reg);
  }

  // Benson's algorithm over this colour's groups.
  const plaGroups: number[] = [];
  groups.forEach((g, id) => {
    if (g.color === pla) plaGroups.push(id);
  });
  const killed = new Set<number>();
  for (;;) {
    const vitalCount = new Map<number, number>();
    for (const reg of regions) {
      if (reg.bordersDead) continue;
      for (const g of reg.vital) vitalCount.set(g, (vitalCount.get(g) ?? 0) + 1);
    }
    let killedAny = false;
    for (const g of plaGroups) {
      if (killed.has(g)) continue;
      if ((vitalCount.get(g) ?? 0) < 2) {
        killed.add(g);
        killedAny = true;
        for (const s of (groups[g] as { stones: number[] }).stones) {
          for (const q of nbrs[s] as number[]) {
            const qc = board[q] as number;
            if (qc === 0 || qc === opp) (regions[regionOf[q] as number] as Region).bordersDead = true;
          }
        }
      }
    }
    if (!killedAny) break;
  }

  for (const g of plaGroups) {
    if (!killed.has(g)) for (const s of (groups[g] as { stones: number[] }).stones) result[s] = pla;
  }
  for (const reg of regions) {
    const mark =
      (reg.internal <= 1 && atLeastOnePla && !reg.bordersDead) ||
      (atLeastOnePla && !reg.containsOpp);
    if (mark) for (const p of reg.locs) result[p] = pla;
  }
}

/** Per point owner (0 none, 1 Black, 2 White) as KataGo's input feature defines it. */
export function featureArea(size: number, board: ArrayLike<number>): Uint8Array {
  const nbrs = neighborsFor(size);
  const { groupId, groups } = analyseGroups(size, board, nbrs);
  const result = new Uint8Array(size * size);
  areaForColor(size, board, nbrs, groupId, groups, 1, result);
  areaForColor(size, board, nbrs, groupId, groups, 2, result);
  for (let p = 0; p < size * size; p++) if (result[p] === 0) result[p] = board[p] as number;
  return result;
}

export function buildFeatures(inp: FeatureInput): NetInputs {
  const { size, board, toPlay, komi } = inp;
  const pla = toPlay;
  const opp = 3 - pla;
  const spatial = new Float32Array(NUM_SPATIAL * POS_LEN * POS_LEN);
  const global = new Float32Array(NUM_GLOBAL);
  const plane = POS_LEN * POS_LEN;
  const pos = (p: number): number => Math.floor(p / size) * POS_LEN + (p % size);
  const set = (ch: number, p: number): void => {
    spatial[ch * plane + pos(p)] = 1;
  };
  const nbrs = neighborsFor(size);
  const { groupId, groups } = analyseGroups(size, board, nbrs);

  for (let p = 0; p < size * size; p++) {
    set(0, p);
    const c = board[p] as number;
    if (c === pla) set(1, p);
    else if (c === opp) set(2, p);
    if (c !== 0) {
      const libs = (groups[groupId[p] as number] as { libs: number }).libs;
      if (libs === 1) set(3, p);
      else if (libs === 2) set(4, p);
      else if (libs === 3) set(5, p);
    }
  }

  for (const p of inp.koPoints) set(6, p);

  // The last five moves, which must alternate starting with the opponent's.
  const h = inp.history;
  for (let k = 1; k <= 5; k++) {
    const m = h[h.length - k];
    const expected = k % 2 === 1 ? opp : pla;
    if (!m || m.color !== expected) break;
    if (m.point >= 0) set(8 + k, m.point);
    else global[k - 1] = 1;
  }

  const area = featureArea(size, board);
  for (let p = 0; p < size * size; p++) {
    if (area[p] === pla) set(18, p);
    else if (area[p] === opp) set(19, p);
  }

  // Global features.
  const bArea = size * size;
  let selfKomi = pla === 2 ? komi : -komi;
  selfKomi = Math.max(-bArea - 1, Math.min(bArea + 1, selfKomi));
  global[5] = selfKomi / 20;
  global[6] = 1; // positional superko
  global[7] = 0.5;
  const areaIsEven = size % 2 === 0;
  const komiFloor = areaIsEven
    ? Math.floor(selfKomi / 2) * 2
    : Math.floor((selfKomi - 1) / 2) * 2 + 1;
  const delta = Math.max(0, Math.min(2, selfKomi - komiFloor));
  global[18] = delta < 0.5 ? delta : delta < 1.5 ? 1 - delta : delta - 2;

  return { spatial, global };
}

/** Inputs for the network from a game state. */
export function featuresFromState(state: GameState): NetInputs {
  const size = state.size;
  const koPoints: number[] = [];
  const last = state.moves[state.moves.length - 1];
  if (last && last.move.kind === "play" && last.captured > 0) {
    for (let p = 0; p < size * size; p++) {
      if (state.board[p] === 0 && illegalReason(state, p % size, Math.floor(p / size)) === "ko") koPoints.push(p);
    }
  }
  const history: PastMove[] = state.moves.slice(-5).map((m) => ({
    color: m.color,
    point: m.move.kind === "play" ? m.move.y * size + m.move.x : -1,
  }));
  return buildFeatures({
    size,
    board: state.board as readonly Cell[],
    toPlay: state.toPlay,
    komi: state.komi,
    history,
    koPoints,
  });
}
