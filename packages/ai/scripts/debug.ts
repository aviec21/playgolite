import { boardFromAscii, createFromBoard } from "@playgolite/engine";
import { FastBoard, makeRng } from "../src";
import { search } from "../src/mcts";
const rows = ["XO...", ".X...", ".....", ".....", "....."];
const { size, board } = boardFromAscii(rows);
const s = createFromBoard(size, board, 1, 0);
const fb = FastBoard.fromState(s);
for (const n of [600, 3000]) {
  const r = search(fb, 1, 0, { playouts: n, timeMs: 5000, komi: 0, rng: makeRng(7) });
  console.log(n, r.playouts, r.ranked.slice(0, 5).map((c) => `${c.move % 5},${Math.floor(c.move / 5)} v=${c.visits} w=${c.winRate.toFixed(2)}`).join(" | "));
}
