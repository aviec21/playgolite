import { winningMoves, type Puzzle } from "../src";
const base = { category: "Two moves to capture", difficulty: 3, toPlay: 1, hint: "", answers: [] } as const;
const tests: Array<[string, Puzzle]> = [
  ["N1 open corner", { ...base, id: "n1", title: "n1", rows: [".X..", "XO..", "...."], goal: { type: "capture", at: [1, 1] }, depth: 3, region: [0, 0, 4, 4] }],
  ["N2 enclosed 3 stones", { ...base, id: "n2", title: "n2", rows: [".XX.", "XOO.", ".X..", "...."], goal: { type: "capture", at: [1, 1] }, depth: 2, region: [0, 0, 4, 4] }],
  ["N3 knight net", { ...base, id: "n3", title: "n3", rows: ["....", ".XO.", "..X.", "....","...."], goal: { type: "capture", at: [2, 1] }, depth: 3, region: [0, 0, 5, 5] }],
  ["E3 extend", { ...base, id: "e3", title: "e3", category: "Escape", rows: ["....", "..O.", ".OXO", "...."], goal: { type: "save", at: [2, 2] }, depth: 2, region: [0, 0, 5, 5] }],
  ["S1 snapback try", { ...base, id: "s1", title: "s1", rows: [".XX.", "XOOX", "X..X", ".X.."], goal: { type: "capture", at: [1, 1] }, depth: 3, region: [0, 0, 5, 5] }],
];
for (const [name, p] of tests) {
  const t = Date.now();
  console.log(name.padEnd(22), JSON.stringify(winningMoves(p)), `${Date.now() - t}ms`);
}
