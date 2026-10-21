import type { Puzzle } from "./types";

/**
 * Starter puzzles. Positions are the top-left corner of a 9x9 board.
 * Every `answers` list is checked against the solver in tests, so a wrong
 * puzzle cannot ship.
 */
export const BASE_PUZZLES: Puzzle[] = [
  // ---- Capture ----
  {
    id: "cap-01",
    title: "The last liberty",
    category: "Capture",
    difficulty: 1,
    toPlay: 1,
    rows: ["XO.", ".X."],
    goal: { type: "capture", at: [1, 0] },
    depth: 1,
    region: [0, 0, 4, 3],
    hint: "Count the white stone's liberties. It only has one left.",
    answers: [[2, 0]],
  },
  {
    id: "cap-02",
    title: "Against the edge",
    category: "Capture",
    difficulty: 1,
    toPlay: 1,
    rows: ["X..", "OX.", "..."],
    goal: { type: "capture", at: [0, 1] },
    depth: 1,
    region: [0, 0, 4, 4],
    hint: "The edge counts as a wall. Where can the white stone still breathe?",
    answers: [[0, 2]],
  },
  {
    id: "cap-03",
    title: "Corner stone",
    category: "Capture",
    difficulty: 1,
    toPlay: 1,
    rows: ["OX..", "...."],
    goal: { type: "capture", at: [0, 0] },
    depth: 1,
    region: [0, 0, 4, 4],
    hint: "A stone in the corner has only two liberties. One is already taken.",
    answers: [[0, 1]],
  },
  {
    id: "cap-04",
    title: "Surrounded",
    category: "Capture",
    difficulty: 1,
    toPlay: 1,
    rows: [".X.", "XO.", ".X."],
    goal: { type: "capture", at: [1, 1] },
    depth: 1,
    region: [0, 0, 4, 4],
    hint: "Three sides are closed. Close the fourth.",
    answers: [[2, 1]],
  },
  // ---- Capture a group ----
  {
    id: "grp-01",
    title: "Two stones, one liberty",
    category: "Capture a group",
    difficulty: 1,
    toPlay: 1,
    rows: ["XOO.", ".XX."],
    goal: { type: "capture", at: [1, 0] },
    depth: 1,
    region: [0, 0, 5, 4],
    hint: "Connected stones share their liberties. Find the one they share.",
    answers: [[3, 0]],
  },
  {
    id: "grp-02",
    title: "A wall on the edge",
    category: "Capture a group",
    difficulty: 1,
    toPlay: 1,
    rows: ["X..", "OX.", "OX.", "OX.", "..."],
    goal: { type: "capture", at: [0, 1] },
    depth: 1,
    region: [0, 0, 4, 6],
    hint: "Three white stones in a line. Look at both ends.",
    answers: [[0, 4]],
  },
  {
    id: "grp-03",
    title: "Bent group",
    category: "Capture a group",
    difficulty: 2,
    toPlay: 1,
    rows: [".XX.", "XOOX", ".XOX", "...."],
    goal: { type: "capture", at: [1, 1] },
    depth: 1,
    region: [0, 0, 5, 5],
    hint: "Trace around the whole group. Only one point is still open.",
    answers: [[2, 3]],
  },
  {
    id: "grp-04",
    title: "Square of four",
    category: "Capture a group",
    difficulty: 2,
    toPlay: 1,
    rows: [".XX.", "XOOX", "XOOX", ".X..", "...."],
    goal: { type: "capture", at: [1, 1] },
    depth: 1,
    region: [0, 0, 5, 5],
    hint: "Eight neighbours around the square. Seven are black.",
    answers: [[2, 3]],
  },
  // ---- Two moves to capture ----
  {
    id: "two-01",
    title: "Squeeze",
    category: "Two moves to capture",
    difficulty: 2,
    toPlay: 1,
    rows: [".X..", "XO..", "X.X.", ".X.."],
    goal: { type: "capture", at: [1, 1] },
    depth: 2,
    region: [0, 0, 4, 4],
    hint: "The white stone has two liberties. Take one so it cannot run through the other.",
    answers: [[2, 1]],
  },
  // ---- Escape ----
  {
    id: "esc-01",
    title: "Run!",
    category: "Escape",
    difficulty: 1,
    toPlay: 1,
    rows: [".O.", "OXO", "..."],
    goal: { type: "save", at: [1, 1] },
    depth: 2,
    region: [0, 0, 4, 5],
    hint: "Your stone is in atari. Add a stone that gives it more room.",
    answers: [[1, 2]],
  },
  {
    id: "esc-02",
    title: "Capture to escape",
    category: "Escape",
    difficulty: 2,
    toPlay: 1,
    rows: [".OX..", "OXO..", "..X.."],
    goal: { type: "save", at: [1, 1] },
    depth: 2,
    region: [0, 0, 5, 5],
    hint: "Sometimes the best way out is to take a white stone.",
    answers: [[0, 0], [3, 1], [1, 2]],
  },
  // ---- Connect ----
  {
    id: "con-01",
    title: "Hold hands",
    category: "Connect",
    difficulty: 2,
    toPlay: 1,
    rows: ["....", ".XO.", "..XO", "..O."],
    goal: { type: "save", at: [2, 2] },
    depth: 2,
    region: [0, 0, 5, 5],
    hint: "The lower stone is in atari. Is there a friend nearby to join?",
    answers: [[1, 2]],
  },
  {
    id: "two-02",
    title: "The net",
    category: "Two moves to capture",
    difficulty: 3,
    toPlay: 1,
    rows: ["....", ".XO.", "..X.", "....", "...."],
    goal: { type: "capture", at: [2, 1] },
    depth: 3,
    region: [0, 0, 5, 5],
    hint: "Do not chase from behind. Place a stone where the white stone cannot slip past.",
    answers: [[3, 1]],
  },
  {
    id: "esc-03",
    title: "Extend to safety",
    category: "Escape",
    difficulty: 1,
    toPlay: 1,
    rows: ["....", "..O.", ".OXO", "...."],
    goal: { type: "save", at: [2, 2] },
    depth: 2,
    region: [0, 0, 5, 5],
    hint: "Three sides are closed. Go through the open side.",
    answers: [[2, 3]],
  },
];

const FULL = 9;

function swapRows(rows: string[]): string[] {
  return rows.map((r) => r.replace(/[XO]/g, (c) => (c === "X" ? "o" : "x")).toUpperCase());
}

/**
 * The same shape seen from the other side: reflected left to right and with the
 * colors swapped, so the player takes White on the right-hand side of the board.
 */
function whiteMirror(p: Puzzle): Puzzle {
  const size = p.size ?? FULL;
  const padded = Array.from({ length: size }, (_, y) => (p.rows[y] ?? "").replace(/\s+/g, "").padEnd(size, "."));
  const rows = swapRows(padded.map((r) => [...r].reverse().join("")));
  const flipX = (x: number) => size - 1 - x;
  const [x0, y0, x1, y1] = p.region;
  return {
    ...p,
    id: `${p.id}-w`,
    title: `${p.title} (as White)`,
    toPlay: p.toPlay === 1 ? 2 : 1,
    rows,
    goal: { type: p.goal.type, at: [flipX(p.goal.at[0]), p.goal.at[1]] },
    region: [flipX(x1), y0, flipX(x0), y1],
    answers: p.answers.map(([x, y]) => [flipX(x), y] as const),
  };
}

export const PUZZLES: Puzzle[] = [...BASE_PUZZLES, ...BASE_PUZZLES.map(whiteMirror)];

export const PUZZLE_CATEGORIES = [
  "Capture",
  "Capture a group",
  "Two moves to capture",
  "Escape",
  "Connect",
] as const;
