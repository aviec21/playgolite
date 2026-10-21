import { describe, expect, it } from "vitest";
import { play } from "@playgolite/engine";
import {
  PUZZLES,
  bestDefense,
  goalStatus,
  playerMoveWins,
  puzzleStart,
  refutation,
  winningMoves,
} from "../src";

const key = (p: readonly [number, number]) => `${p[0]},${p[1]}`;

describe("puzzle data", () => {
  it("has unique ids", () => {
    const ids = PUZZLES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every puzzle starts open (goal not already decided)", () => {
    for (const p of PUZZLES) {
      expect(goalStatus(p, puzzleStart(p)), p.id).toBe("open");
    }
  });

  it("the stone named by the goal exists with the right color", () => {
    for (const p of PUZZLES) {
      const s = puzzleStart(p);
      const stone = s.board[p.goal.at[1] * s.size + p.goal.at[0]];
      const expected = p.goal.type === "capture" ? (p.toPlay === 1 ? 2 : 1) : p.toPlay;
      expect(stone, p.id).toBe(expected);
    }
  });
});

describe("solver verifies every puzzle", () => {
  for (const p of PUZZLES) {
    it(`${p.id}: stated answers are exactly the winning first moves`, () => {
      const found = winningMoves(p).map(key).sort();
      const claimed = p.answers.map(key).sort();
      expect(found).toEqual(claimed);
      expect(claimed.length).toBeGreaterThan(0);
    });
  }
});

describe("solver play-through", () => {
  it("a wrong move gets a refutation, and a right move needs none", () => {
    const p = PUZZLES.find((x) => x.id === "two-01") as (typeof PUZZLES)[number];
    const start = puzzleStart(p);

    const wrong = play(start, { kind: "play", x: 3, y: 0 });
    if (!wrong.ok) throw new Error("setup");
    expect(playerMoveWins(p, wrong.state, p.depth)).toBe(false);
    expect(refutation(p, wrong.state, p.depth)).not.toBeNull();

    const right = play(start, { kind: "play", x: 2, y: 1 });
    if (!right.ok) throw new Error("setup");
    expect(playerMoveWins(p, right.state, p.depth)).toBe(true);
  });

  it("the net puzzle plays out to a capture against best defence", () => {
    const p = PUZZLES.find((x) => x.id === "two-02") as (typeof PUZZLES)[number];
    let s = puzzleStart(p);
    let left = p.depth;
    // The player plays a winning move, the defender answers, and so on until captured.
    for (let guard = 0; guard < 6 && goalStatus(p, s) === "open"; guard++) {
      const w = winningMoves(p, s, left);
      expect(w.length).toBeGreaterThan(0);
      const [x, y] = w[0] as readonly [number, number];
      const r = play(s, { kind: "play", x, y });
      if (!r.ok) throw new Error("illegal winning move");
      s = r.state;
      if (goalStatus(p, s) === "won") break;
      // `left` still counts the move just played, which is what bestDefense expects.
      const d = bestDefense(p, s, left);
      expect(d).not.toBeNull();
      const dr = play(s, d as NonNullable<typeof d>);
      if (!dr.ok) throw new Error("illegal defence");
      s = dr.state;
      left -= 1;
    }
    expect(goalStatus(p, s)).toBe("won");
  });
});
