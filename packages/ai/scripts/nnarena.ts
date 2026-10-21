import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { createGame, isLegal, play, score, toggleDead, type GameState, type Move } from "@playgolite/engine";
import { chooseMove, makeRng, type Level } from "../src";
import { featuresFromState } from "../src/nn/features";
import { deadGroupsFromOwnership, pickNetMove } from "../src/nn/policy";

// usage: tsx nnarena.ts <model.onnx> <opponent level> <games> <size> [temperature]
const [model, oppLevel, gamesS, sizeS, tempS] = process.argv.slice(2) as [string, Level, string, string, string | undefined];
const size = Number(sizeS);
const temp = tempS ? Number(tempS) : 0;
const proc = spawn("python3", ["/tmp/nn_server.py", model], { stdio: ["pipe", "pipe", "inherit"] });
const rl = createInterface({ input: proc.stdout });
const waiting: Array<(v: { p: number[]; v: number[]; o: number[] }) => void> = [];
rl.on("line", (l) => (waiting.shift() as (v: { p: number[]; v: number[]; o: number[] }) => void)(JSON.parse(l)));
const rng = makeRng(77);

function ask(state: GameState): Promise<{ p: number[]; v: number[]; o: number[] }> {
  const f = featuresFromState(state);
  const s = Buffer.from(f.spatial.buffer).toString("base64");
  const g = Buffer.from(f.global.buffer).toString("base64");
  return new Promise((resolve) => {
    waiting.push(resolve);
    proc.stdin.write(JSON.stringify({ s, g }) + "\n");
  });
}

async function nnMove(state: GameState): Promise<Move> {
  const out = await ask(state);
  return pickNetMove(state, { policy: out.p, value: out.v, ownership: [] }, { temperature: temp, rng });
}

const games = Number(gamesS);
let nnWins = 0;
for (let i = 0; i < games; i++) {
  const nnBlack = i % 2 === 0;
  let state = createGame({ size });
  let plies = 0;
  const t0 = Date.now();
  while (state.status === "playing" && plies < size * size * 3) {
    const nnTurn = (state.toPlay === 1) === nnBlack;
    const move = nnTurn ? await nnMove(state) : chooseMove(state, oppLevel, { rng }).move;
    const r = play(state, move);
    if (!r.ok) throw new Error(`illegal move by ${nnTurn ? "nn" : oppLevel}`);
    state = r.state;
    plies++;
  }
  if (state.status === "scoring") {
    // Dead stones from the network's own ownership map, as the app does.
    const own = await ask(state);
    for (const p of deadGroupsFromOwnership(state, own.o)) state = toggleDead(state, p % size, Math.floor(p / size));
  }
  const sc = score(state);
  if (sc.margin === 0 || process.env.SHOW || (sc.winner !== null && (sc.winner === 1) !== nnBlack)) {
    const rows: string[] = [];
    for (let y = 0; y < size; y++) rows.push(Array.from({ length: size }, (_, x) => ['.', 'X', 'O'][state.board[y * size + x] as number]).join(''));
    console.log(rows.join('\n'), 'status', state.status, 'winner', sc.winner, 'black', sc.blackScore, 'white', sc.whiteScore, 'dead', JSON.stringify(state.dead), 'last', JSON.stringify(state.moves.slice(-4).map((m) => [m.color, m.move])));
  }
  const win = sc.winner !== null && (sc.winner === 1) === nnBlack;
  if (win) nnWins++;
  console.log(`game ${i + 1}: NN as ${nnBlack ? "B" : "W"} ${win ? "WIN" : "loss"} (${plies} plies, margin ${sc.margin}, ${Math.round((Date.now() - t0) / 1000)}s)`);
}
console.log(`RESULT NN(policy only, temp ${temp}) vs ${oppLevel} on ${size}x${size}: ${nnWins}/${games}`);
proc.kill();
