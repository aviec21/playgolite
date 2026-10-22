import { groupAt, idx } from "@playgolite/engine";
import { puzzleStart, winningMoves } from "../src/solver";
import type { Puzzle } from "../src/types";

let seed = Number(process.argv[2] ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const ri = (n: number) => Math.floor(rnd() * n);
const mode = process.argv[3] ?? "capture"; // capture | escape
const count = Number(process.argv[4] ?? 60);
const W = 5, H = 5;

function nbrs(x: number, y: number) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].filter(([a, b]) => a! >= 0 && b! >= 0 && a! < W && b! < H) as Array<[number, number]>;
}

function make(): { rows: string[]; at: [number, number]; depth: number } | null {
  const g: string[][] = Array.from({ length: H }, () => Array(W).fill("."));
  const target = mode === "capture" ? "O" : "X";
  const foe = mode === "capture" ? "X" : "O";
  // grow the target group
  const k = 1 + ri(4);
  const sx = ri(W - 1), sy = ri(H - 1);
  const cells: Array<[number, number]> = [[sx, sy]];
  g[sy]![sx] = target;
  while (cells.length < k) {
    const c = cells[ri(cells.length)]!;
    const n = nbrs(c[0], c[1])[ri(4 > nbrs(c[0], c[1]).length ? nbrs(c[0], c[1]).length : 4)];
    if (!n || g[n[1]]![n[0]] !== ".") continue;
    g[n[1]]![n[0]] = target;
    cells.push(n);
  }
  // surround with foe stones, leaving some liberties
  const libs: Array<[number, number]> = [];
  for (const c of cells) for (const n of nbrs(c[0], c[1])) if (g[n[1]]![n[0]] === "." && !libs.some((l) => l[0] === n[0] && l[1] === n[1])) libs.push(n);
  const keep = 2 + ri(2);
  libs.sort(() => rnd() - 0.5);
  for (const l of libs.slice(keep)) g[l[1]]![l[0]] = foe;
  // friendly and foe stones nearby
  const extra = ri(5);
  for (let i = 0; i < extra; i++) {
    const x = ri(W), y = ri(H);
    if (g[y]![x] === ".") g[y]![x] = rnd() < 0.55 ? foe : target === "O" ? "X" : "O";
  }
  return { rows: g.map((r) => r.join("")), at: cells[0]!, depth: 2 + ri(2) };
}

const seen = new Set<string>();
const stat: Record<string, number> = {};
const drop = (k: string) => { stat[k] = (stat[k] ?? 0) + 1; };
let found = 0, tries = 0;
while (found < count && tries < 20000) {
  tries++;
  const c = make();
  if (!c || seen.has(c.rows.join("/"))) continue;
  seen.add(c.rows.join("/"));
  const p: Puzzle = {
    id: "gen", title: "", category: "Capture", difficulty: 1, toPlay: 1, rows: c.rows,
    goal: { type: mode === "capture" ? "capture" : "save", at: c.at }, depth: c.depth,
    region: [0, 0, W - 1, H - 1], hint: "", answers: [],
  };
  let start;
  try { start = puzzleStart(p); } catch { continue; }
  const tIdx = idx(start.size, c.at[0], c.at[1]);
  const want = mode === "capture" ? 2 : 1;
  if (start.board[tIdx] !== want) { drop("target"); continue; }
  // target must have >= 2 liberties (capture) or be threatened (escape: <=2)
  const lib = groupAt(start.board, start.size, tIdx).liberties.length;
  if (mode === "capture" && lib < 2) { drop("lib"); continue; }
  if (mode === "escape" && (lib < 1 || lib > 2)) continue;
  // all stones must start with at least one liberty
  let bad = false;
  for (let i = 0; i < start.board.length && !bad; i++) if (start.board[i] !== 0 && groupAt(start.board, start.size, i).liberties.length === 0) bad = true;
  if (bad) { drop("bad"); continue; }
  const t0 = Date.now();
  const w = winningMoves(p);
  if (Date.now() - t0 > 3000) { drop("slow"); continue; }
  if (w.length < 1) { drop("nowin"); continue; }
  if (w.length > (mode === "escape" ? 3 : 2)) { drop("many"); continue; }
  // must need the stated depth: not solvable with one move less
  if (c.depth > 1 && mode === "capture") {
    const shallow = winningMoves({ ...p, depth: c.depth - 1 });
    if (shallow.length > 0) { drop("shallow"); continue; }
  }
  found++;
  console.log(JSON.stringify({ rows: c.rows, goal: p.goal, depth: c.depth, answers: w, ms: Date.now() - t0 }));
}

console.error(JSON.stringify(stat), "tries", tries);
