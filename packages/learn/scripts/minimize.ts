import { readFileSync } from "node:fs";
import { winningMoves } from "../src/solver";
import type { Puzzle } from "../src/types";

const file = process.argv[2]!;
const out: unknown[] = [];
for (const line of readFileSync(file, "utf8").split("\n").filter(Boolean)) {
  const d = JSON.parse(line) as { rows: string[]; goal: Puzzle["goal"]; depth: number; answers: Array<[number, number]> };
  let rows = d.rows.map((r) => r.split(""));
  const base = (rs: string[][]): Puzzle => ({
    id: "m", title: "", category: "Capture", difficulty: 1, toPlay: 1, rows: rs.map((r) => r.join("")), goal: d.goal,
    depth: d.depth, region: [0, 0, 4, 4], hint: "", answers: [],
  });
  const key = (w: Array<readonly [number, number]>) => JSON.stringify(w.map((p) => `${p[0]},${p[1]}`).sort());
  const want = key(d.answers);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++) {
      if (rows[y]![x] === "." || (x === d.goal.at[0] && y === d.goal.at[1])) continue;
      const saved = rows[y]![x]!;
      rows[y]![x] = ".";
      try {
        const p = base(rows);
        const w = winningMoves(p);
        // the stones of the target group must stay; do not allow answers to change
        if (key(w) !== want) rows[y]![x] = saved;
      } catch {
        rows[y]![x] = saved;
      }
    }
  // trim empty rows/cols on the far side
  let h = 5, w = 5;
  while (h > 1 && rows[h - 1]!.every((c) => c === ".")) h--;
  while (w > 1 && rows.every((r) => r[w - 1] === ".")) w--;
  out.push({ ...d, rows: rows.slice(0, h).map((r) => r.slice(0, w).join("")) });
}
for (const o of out) console.log(JSON.stringify(o));
