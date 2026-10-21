import { createGame, playOrThrow } from "@playgolite/engine";
import { FastBoard, makeRng } from "../src";
import { search } from "../src/mcts";
for (const size of [9, 13, 19]) {
  let s = createGame({ size });
  s = playOrThrow(s, 2, 2); s = playOrThrow(s, size - 3, size - 3); s = playOrThrow(s, 2, size - 3);
  const fb = FastBoard.fromState(s);
  const t = Date.now();
  const r = search(fb, 2, 0, { playouts: 100000, timeMs: 2000, komi: s.komi, rng: makeRng(5) });
  console.log(`${size}x${size}: ${r.playouts} playouts in ${Date.now() - t}ms => ${Math.round(r.playouts / ((Date.now() - t) / 1000))}/s`);
}
