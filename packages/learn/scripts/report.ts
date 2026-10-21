import { PUZZLES, winningMoves } from "../src";
for (const p of PUZZLES) {
  const t = Date.now();
  const w = winningMoves(p);
  const claimed = JSON.stringify(p.answers);
  console.log(`${p.id.padEnd(8)} wins=${JSON.stringify(w)} claimed=${claimed} (${Date.now() - t}ms)`);
}
