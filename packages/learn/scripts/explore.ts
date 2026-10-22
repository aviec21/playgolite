import { winningMoves, puzzleStart } from "../src/solver";
import type { Puzzle } from "../src/types";

interface Cand { id: string; rows: string[]; goal: "capture" | "save"; at: [number, number]; depth: number; region: [number, number, number, number]; toPlay?: 1 | 2 }
const cands: Cand[] = JSON.parse(process.argv[2] ?? "[]");
for (const c of cands) {
  const p: Puzzle = {
    id: c.id, title: c.id, category: "Capture", difficulty: 1, toPlay: c.toPlay ?? 1, rows: c.rows,
    goal: { type: c.goal, at: c.at }, depth: c.depth, region: c.region, hint: "", answers: [],
  };
  const t0 = Date.now();
  const w = winningMoves(p);
  console.log(c.id, "depth", c.depth, "->", JSON.stringify(w), `${Date.now() - t0}ms`);
}
void puzzleStart;
