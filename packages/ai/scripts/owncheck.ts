import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { boardFromAscii, createFromBoard, finishScoring, score, toggleDead } from "@playgolite/engine";
import { featuresFromState } from "../src/nn/features";
import { deadGroupsFromOwnership } from "../src/nn/policy";

const rows = ["....OXO..","..O..XOX.","...O.XXO.","..XO.XOOO",".XXXXXXXO",".XO.XOOO.","..O.XXO..","..O..XO..","........."];
const { size, board } = boardFromAscii(rows);
const proc = spawn("python3", ["/tmp/nn_server.py", "/tmp/model/kata_int8.onnx"], { stdio: ["pipe", "pipe", "inherit"] });
const rl = createInterface({ input: proc.stdout });
for (const toPlay of [1, 2] as const) {
  const state = createFromBoard(size, board, toPlay, 7);
  const f = featuresFromState(state);
  const line = new Promise<string>((res) => rl.once("line", res));
  proc.stdin.write(JSON.stringify({ s: Buffer.from(f.spatial.buffer).toString("base64"), g: Buffer.from(f.global.buffer).toString("base64") }) + "\n");
  const out = JSON.parse(await line) as { o: number[]; v: number[] };
  const dead = deadGroupsFromOwnership(state, out.o);
  let s = state;
  for (const p of dead) s = toggleDead(s, p % size, Math.floor(p / size));
  const sc = score(s);
  console.log("toPlay", toPlay, "dead", JSON.stringify(dead), "value", out.v.map((x) => x.toFixed(2)).join(","), "black", sc.blackScore, "white", sc.whiteScore);
  console.log(Array.from({ length: size }, (_, y) => Array.from({ length: size }, (_, x) => (out.o[y * 19 + x] as number).toFixed(1).padStart(5)).join("")).join("\n"));
}
proc.kill();
