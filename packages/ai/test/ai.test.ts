import { describe, expect, it } from "vitest";
import {
  boardFromAscii,
  createFromBoard,
  createGame,
  idx,
  illegalReason,
  isLegal,
  play,
  score,
  toggleDead,
  type GameState,
} from "@playgolite/engine";
import { FastBoard, LEVELS, chooseMove, estimateDeadGroups, makeRng, type Level } from "../src";

function fromPicture(rows: string[], toPlay: 1 | 2, komi = 0): GameState {
  const { size, board } = boardFromAscii(rows);
  return createFromBoard(size, board, toPlay, komi);
}

describe("FastBoard matches the rules engine", () => {
  for (const size of [5, 9]) {
    it(`random games on ${size}x${size}: same legality, captures and area`, () => {
      const rng = makeRng(1234 + size);
      for (let game = 0; game < 25; game++) {
        let state = createGame({ size, komi: 0 });
        const fb = new FastBoard(size);
        let color = 1;
        for (let move = 0; move < size * size * 3; move++) {
          const p = Math.floor(rng() * size * size);
          const x = p % size;
          const y = Math.floor(p / size);
          const reason = illegalReason(state, x, y);
          if (reason === "ko") continue; // superko is stricter than the fast board's simple ko
          const before = fb.cells.slice();
          const got = fb.play(p, color);
          if (reason) {
            expect(got, `${reason} at ${x},${y}`).toBe(-1);
            expect(Array.from(fb.cells)).toEqual(Array.from(before));
            continue;
          }
          expect(got).toBeGreaterThanOrEqual(0);
          const r = play(state, { kind: "play", x, y });
          if (!r.ok) throw new Error("engine disagreed");
          state = r.state;
          expect(Array.from(fb.cells)).toEqual(Array.from(state.board));
          color = 3 - color;
        }
        const s = score(state);
        expect(fb.areaDiff()).toBe(s.blackArea - s.whiteArea);
        const owners = fb.owners();
        expect(Array.from(owners)).toEqual(Array.from(s.owner));
      }
    });
  }
});

describe("chooseMove", () => {
  const levels = LEVELS.map((l) => l.id) as Level[];

  for (const level of levels) {
    it(`${level} always returns a legal move or a pass`, () => {
      const rng = makeRng(99);
      let state = createGame({ size: 9 });
      for (let i = 0; i < 40 && state.status === "playing"; i++) {
        const choice = chooseMove(state, level, { rng, budgetScale: 0.02 });
        if (choice.move.kind === "play") {
          expect(isLegal(state, choice.move.x, choice.move.y)).toBe(true);
        }
        const r = play(state, choice.move);
        if (!r.ok) throw new Error(`${level} produced an illegal move`);
        state = r.state;
      }
    });
  }

  it("passes when the opponent passed and it is clearly ahead", () => {
    const s0 = fromPicture(
      ["XXXXX", "XXXXX", "XXXXX", "XXXXX", "....O"],
      2,
      0.5,
    );
    // White passes, so Black (far ahead) is to move and should pass to end the game.
    const r = play(s0, { kind: "pass" });
    if (!r.ok) throw new Error("setup");
    for (const level of ["beginner", "easy", "medium"] as Level[]) {
      expect(chooseMove(r.state, level, { budgetScale: 0.05 }).move.kind).toBe("pass");
    }
  });

  it("captures a stone in atari at the easy level", () => {
    const s = fromPicture(["XO...", ".X...", ".....", ".....", "....."], 1);
    // White (1,0) has one liberty at (2,0). Capturing is the clear tactical move.
    const c = chooseMove(s, "easy", { rng: makeRng(5) });
    expect(c.move).toEqual({ kind: "play", x: 2, y: 0 });
  });
});

describe("estimateDeadGroups", () => {
  it("flags a lone stone deep inside enemy territory but not the living wall", () => {
    const s = fromPicture(
      ["XXXXXXX", "X.X.X.X", "XXXXXXX", "XXX.OXX", "XXXXXXX", "X.X.X.X", "XXXXXXX"],
      1,
    );
    const dead = estimateDeadGroups(s, 150, makeRng(3));
    expect(dead).toContain(idx(7, 4, 3));
    expect(dead).not.toContain(idx(7, 0, 0));
  });

  it("works with toggleDead to give the right final score", () => {
    let s = fromPicture(
      ["XXXXXXX", "X.X.X.X", "XXXXXXX", "XXX.OXX", "XXXXXXX", "X.X.X.X", "XXXXXXX"],
      1,
    );
    s = { ...s, status: "scoring" };
    for (const p of estimateDeadGroups(s, 150, makeRng(3))) s = toggleDead(s, p % 7, Math.floor(p / 7));
    expect(score(s).whiteArea).toBe(0);
    expect(score(s).blackArea).toBe(49);
  });
});
