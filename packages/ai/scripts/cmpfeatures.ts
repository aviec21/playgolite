import { readFileSync } from "node:fs";
import { buildFeatures } from "../src/nn/features";

const fx = JSON.parse(readFileSync(new URL("../test/fixtures/katago-features.json", import.meta.url), "utf8")) as Array<{
  size: number; komi: number; toPlay: number; board: number[]; history: Array<[number, number]>; ko: number[];
  spatial: number[]; global: number[];
}>;
const plane = 361;
const diffs = new Map<number, number>();
let globalBad = 0;
for (const f of fx) {
  const r = buildFeatures({ size: f.size, board: f.board, toPlay: f.toPlay, komi: f.komi, history: f.history.map(([color, point]) => ({ color, point })), koPoints: f.ko });
  for (let c = 0; c < 22; c++) {
    let bad = 0;
    for (let i = 0; i < plane; i++) if (Math.abs((r.spatial[c * plane + i] as number) - (f.spatial[c * plane + i] as number)) > 1e-3) bad++;
    if (bad) diffs.set(c, (diffs.get(c) ?? 0) + 1);
  }
  for (let i = 0; i < 19; i++) if (Math.abs((r.global[i] as number) - (f.global[i] as number)) > 1e-3) { globalBad++; console.log("global", i, r.global[i], f.global[i]); }
}
console.log("positions", fx.length, "global mismatches", globalBad);
console.log("planes with any mismatch (plane: positions differing):", Object.fromEntries(diffs));
