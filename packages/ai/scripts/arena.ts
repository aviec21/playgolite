import { createGame, play, score, toggleDead, type GameState } from "@playgolite/engine";
import { chooseMove, estimateDeadGroups, makeRng, type Level } from "../src";

function finish(state: GameState): number {
  let s = state;
  if (s.status === "scoring") {
    for (const p of estimateDeadGroups(s, 300, makeRng(11))) s = toggleDead(s, p % s.size, Math.floor(p / s.size));
  }
  const r = score(s);
  return r.winner ?? 0;
}

function game(black: Level, white: Level, scale: number, seed: number): { winner: number; plies: number } {
  let state = createGame({ size: 9 });
  const rng = makeRng(seed);
  let plies = 0;
  while (state.status === "playing" && plies < 220) {
    const level = state.toPlay === 1 ? black : white;
    const c = chooseMove(state, level, { rng, budgetScale: scale });
    const r = play(state, c.move);
    if (!r.ok) throw new Error(`${level} made an illegal move`);
    state = r.state;
    plies++;
  }
  return { winner: finish(state), plies };
}

const [strong, weak, gamesStr, scaleStr] = process.argv.slice(2) as [Level, Level, string, string];
const games = Number(gamesStr);
const scale = Number(scaleStr);
let strongWins = 0;
const t0 = Date.now();
for (let i = 0; i < games; i++) {
  const strongIsBlack = i % 2 === 0;
  const res = game(strongIsBlack ? strong : weak, strongIsBlack ? weak : strong, scale, 100 + i);
  const won = (res.winner === 1) === strongIsBlack && res.winner !== 0;
  if (won) strongWins++;
  console.log(`game ${i + 1}: ${strong} as ${strongIsBlack ? "B" : "W"} -> ${won ? "WIN" : "loss"} (${res.plies} plies)`);
}
console.log(`RESULT ${strong} vs ${weak}: ${strongWins}/${games} wins, scale ${scale}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
