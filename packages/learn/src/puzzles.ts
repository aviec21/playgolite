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

type Row = string[];
type PT = [number, number];

/** Compact constructor for the puzzles below. Every answer list is verified by the solver in tests. */
function mk(
  id: string,
  title: string,
  category: Puzzle["category"],
  difficulty: Puzzle["difficulty"],
  rows: Row,
  goal: Puzzle["goal"]["type"],
  at: PT,
  depth: number,
  region: Puzzle["region"],
  hint: string,
  answers: PT[],
): Puzzle {
  return { id, title, category, difficulty, toPlay: 1, rows, goal: { type: goal, at }, depth, region, hint, answers };
}

const R5 = [0, 0, 4, 4] as const;

/** More tactics, found by search and kept only when the solver proves the answer. */
const MORE_PUZZLES: Puzzle[] = [
  // ---- Two moves to capture ----
  mk("two-03", "Cut the run", "Two moves to capture", 2, ["....", "....", "O.X.", "OOOX", "XXX."], "capture", [0, 3], 2, R5, "The group is cramped against the left edge. Which of its liberties is the only way out?", [[0, 1]]),
  mk("two-04", "Pin it to the edge", "Two moves to capture", 2, ["O..", "OOX", ".X."], "capture", [1, 1], 2, R5, "Two liberties are left. Take the one that also blocks the way out.", [[0, 2]]),
  mk("two-05", "Underneath", "Two moves to capture", 2, ["...", "...", ".OX", "XOX", ".X."], "capture", [1, 3], 2, R5, "The white stones are linked above and below. Cut where they join.", [[1, 1]]),
  mk("two-06", "Long and thin", "Two moves to capture", 2, ["...", "XXX", "OOO", "X.X"], "capture", [0, 2], 2, R5, "Look at the gap in your own wall. White wants to run through it.", [[3, 2]]),
  mk("two-07", "Top edge", "Two moves to capture", 2, ["OOOX", ".O..", ".X.."], "capture", [1, 0], 2, R5, "Block the downward escape. The edge does the rest.", [[2, 1]]),
  mk("two-08", "A hole in the wall", "Two moves to capture", 3, ["..X.", ".XOO", "..XX"], "capture", [3, 1], 2, R5, "Only one white liberty is not yet shared with your stones. Take it.", [[4, 1]]),
  mk("two-09", "Corner pinch", "Two moves to capture", 2, [".O.", "OOX", "XX."], "capture", [1, 1], 2, R5, "Which liberty gives the white group the most room to grow?", [[2, 0]]),
  // ---- Three moves to capture ----
  mk("thr-01", "Edge chase", "Three moves to capture", 3, [".OOOX", ".OXX."], "capture", [1, 0], 3, R5, "The right side is shut. Make the group run to the left, then close in from below.", [[1, 2]]),
  mk("thr-02", "Shut the door", "Three moves to capture", 3, ["..OX", "..O.", ".XX."], "capture", [2, 0], 3, R5, "The white stones can only breathe on the right. Shut that door first.", [[3, 1]]),
  mk("thr-03", "Two ways in", "Three moves to capture", 3, ["X..", "OOX", "OOX", ".X."], "capture", [0, 2], 3, R5, "Either side works. Count how many moves each way needs.", [[2, 0], [0, 3]]),
  mk("thr-04", "Both sides", "Three moves to capture", 3, [".....", "..X.X", "XOO..", ".XOX.", "..X.."], "capture", [2, 3], 3, R5, "The marked stones are almost surrounded. Find the gaps that matter.", [[1, 1], [3, 2]]),
  mk("thr-05", "The tall wall", "Three moves to capture", 3, ["..X..", "..X..", ".XOOX", "...X."], "capture", [3, 2], 3, R5, "Block the open point below the pair, not the one beside it.", [[2, 3]]),
  mk("thr-06", "Net and trap", "Three moves to capture", 3, ["...OX", ".X.O.", "...X."], "capture", [3, 0], 3, R5, "A loose net holds better than a chase. Play where the stone cannot slip out.", [[4, 1]]),
  // ---- Escape ----
  mk("esc-04", "Breathing room", "Escape", 2, ["O...O", ".....", "..O..", "..XO.", "..O.."], "save", [2, 3], 2, R5, "Your stone is nearly shut in. Go where it can breathe.", [[1, 3]]),
  mk("esc-05", "Push through", "Escape", 3, ["OO..O", "XXO..", ".O...", "...O.", "....."], "save", [0, 1], 3, R5, "Do not wait. The open side is above.", [[2, 0]]),
  mk("esc-06", "Side step", "Escape", 2, [".OXO.", "..XO.", "..OO.", ".....", "....."], "save", [2, 0], 2, R5, "Push into the one gap in the white wall.", [[1, 1]]),
  mk("esc-07", "Down the edge", "Escape", 3, ["O....", "XO...", "XO...", "X....", "O...."], "save", [0, 1], 3, R5, "The white stones below are thin. Find where they are not connected.", [[1, 3]]),
  mk("esc-08", "Cut and run", "Escape", 3, [".O...", "XX...", "XO...", "XO...", "O...."], "save", [0, 1], 3, R5, "A cut can be the best defence.", [[2, 1]]),
  mk("esc-09", "Out of the middle", "Escape", 3, ["..O..", "OOXO.", "..X..", ".OXO.", "O.O.."], "save", [2, 2], 3, R5, "The long column has one way out. Take it before White closes it.", [[3, 0]]),
  mk("esc-10", "One more liberty", "Escape", 2, [".O...", ".....", ".....", "..OXO", "...O."], "save", [3, 3], 2, R5, "Your stone has two liberties. Add a third to be safe.", [[3, 2]]),
  // ---- Life and death ----
  mk("ld-01", "The middle of three", "Life and death", 4, ["XO...OX", "XOOOOOX", "XXXXXXX"], "capture", [1, 0], 5, [0, 0, 7, 3], "White has a row of three empty points inside. If White gets the middle, that is two eyes. Take it first.", [[3, 0]]),
  mk("ld-02", "Same shape, bigger", "Life and death", 4, ["XOO...OOX", "XOOOOOOOX", "XXXXXXXXX"], "capture", [1, 0], 5, [0, 0, 8, 3], "Count the empty points in the row. The vital point is in the middle.", [[4, 0]]),
  mk("ld-03", "Corner row of three", "Life and death", 5, ["...OX", "OOOOX", "XXXX."], "capture", [3, 0], 5, [0, 0, 5, 3], "The same vital point idea, but the corner is also an eye point.", [[1, 0]]),
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

const LIFE_LIVE: Puzzle = {
  id: "ld-04",
  title: "Make two eyes",
  category: "Life and death",
  difficulty: 4,
  toPlay: 1,
  rows: ["OX...XO", "OXXXXXO", "OOOOOOO"],
  goal: { type: "save", at: [1, 0] },
  depth: 5,
  region: [0, 0, 7, 3],
  hint: "Your group has a row of three empty points. White would play the middle. You play it first.",
  answers: [[3, 0]],
};

const ALL_BASE: Puzzle[] = [...BASE_PUZZLES, ...MORE_PUZZLES, LIFE_LIVE];

const UNSORTED: Puzzle[] = [...ALL_BASE, ...ALL_BASE.map(whiteMirror)];

export const PUZZLE_CATEGORIES = [
  "Capture",
  "Capture a group",
  "Two moves to capture",
  "Three moves to capture",
  "Escape",
  "Connect",
  "Life and death",
] as const;

/** Grouped by category, easiest first, so "Next puzzle" walks through them in a sensible order. */
export const PUZZLES: Puzzle[] = UNSORTED.map((p, i) => ({ p, i }))
  .sort(
    (a, b) =>
      PUZZLE_CATEGORIES.indexOf(a.p.category) - PUZZLE_CATEGORIES.indexOf(b.p.category) ||
      a.p.difficulty - b.p.difficulty ||
      a.i - b.i,
  )
  .map((x) => x.p);
