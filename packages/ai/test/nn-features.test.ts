import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildFeatures } from "../src/nn/features";
import { deadGroupsFromOwnership } from "../src/nn/policy";
import { boardFromAscii, createFromBoard, toggleDead } from "@playgolite/engine";

interface Fixture {
  size: number;
  komi: number;
  toPlay: number;
  board: number[];
  history: Array<[number, number]>;
  ko: number[];
  spatial: number[];
  global: number[];
}

// Reference values produced by KataGo's own python feature code (python/katago/game/features.py).
const fixtures = JSON.parse(
  readFileSync(new URL("./fixtures/katago-features.json", import.meta.url), "utf8"),
) as Fixture[];

describe("KataGo input features", () => {
  it("match the reference code on every plane except the ladder planes", () => {
    const plane = 19 * 19;
    for (const f of fixtures) {
      const r = buildFeatures({
        size: f.size,
        board: f.board,
        toPlay: f.toPlay,
        komi: f.komi,
        history: f.history.map(([color, point]) => ({ color, point })),
        koPoints: f.ko,
      });
      for (let c = 0; c < 22; c++) {
        if (c >= 14 && c <= 17) continue; // ladder planes are left empty on purpose
        for (let i = 0; i < plane; i++) {
          expect(r.spatial[c * plane + i]).toBeCloseTo(f.spatial[c * plane + i] as number, 3);
        }
      }
      for (let i = 0; i < 19; i++) expect(r.global[i]).toBeCloseTo(f.global[i] as number, 3);
    }
  });
});

describe("dead stones from ownership", () => {
  it("marks groups the network gives to the other side", () => {
    const { size, board } = boardFromAscii(["XXXXO", "XXXXO", "XXXXO", "XXXXO", "XXXX."]);
    let state = createFromBoard(size, board, 1, 0.5);
    // Everything belongs to the player to move (positive logits), so the lone white wall is dead.
    const own = new Float32Array(19 * 19).fill(3);
    const dead = deadGroupsFromOwnership(state, own);
    expect(dead).toHaveLength(1);
    state = { ...state, status: "scoring" };
    state = toggleDead(state, dead[0]! % size, Math.floor(dead[0]! / size));
    expect(state.dead.length).toBe(4);
  });
});
