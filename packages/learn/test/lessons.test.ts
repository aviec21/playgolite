import { describe, expect, it } from "vitest";
import { groupAt, idx, illegalReason, legalMoves, play } from "@playgolite/engine";
import {
  LESSONS,
  countAnswer,
  countOptions,
  createsAtari,
  evaluateLessonMove,
  lessonStepState,
} from "../src";

const steps = LESSONS.flatMap((l) => l.steps.map((s, i) => ({ lesson: l.id, i, step: s })));

describe("lesson data", () => {
  it("has ten lessons with unique ids", () => {
    expect(LESSONS.length).toBe(10);
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(10);
  });

  it("every lesson board builds a valid position", () => {
    for (const { lesson, i, step } of steps) {
      if (step.board) expect(() => lessonStepState(step), `${lesson}#${i}`).not.toThrow();
    }
  });

  it("move tasks have boards, and choice answers are in range", () => {
    for (const { lesson, i, step } of steps) {
      const t = step.task;
      if (["play-any", "play-at", "capture", "atari", "illegal", "count"].includes(t.type)) {
        expect(step.board, `${lesson}#${i}`).toBeDefined();
      }
      if (t.type === "choice") {
        expect(t.answer).toBeGreaterThanOrEqual(0);
        expect(t.answer).toBeLessThan(t.options.length);
      }
    }
  });
});

describe("every lesson task can actually be completed", () => {
  for (const { lesson, i, step } of steps) {
    const state = lessonStepState(step);
    const t = step.task;
    it(`${lesson} step ${i + 1} (${t.type})`, () => {
      if (!state) return;
      if (t.type === "play-at") {
        for (const [x, y] of t.points) {
          expect(evaluateLessonMove(step, state, x, y).kind).toBe("success");
        }
      } else if (t.type === "illegal") {
        for (const [x, y] of t.points) {
          expect(illegalReason(state, x, y)).toBe(t.reason);
          expect(evaluateLessonMove(step, state, x, y).kind).toBe("success");
        }
      } else if (t.type === "capture") {
        const ok = legalMoves(state).some((p) => {
          const x = p % state.size;
          const y = Math.floor(p / state.size);
          return evaluateLessonMove(step, state, x, y).kind === "success";
        });
        expect(ok).toBe(true);
      } else if (t.type === "atari") {
        const ok = legalMoves(state).some((p) => {
          const x = p % state.size;
          const y = Math.floor(p / state.size);
          const r = play(state, { kind: "play", x, y });
          return r.ok && createsAtari(r.state, x, y);
        });
        expect(ok).toBe(true);
      } else if (t.type === "play-any") {
        expect(legalMoves(state).length).toBeGreaterThan(0);
      } else if (t.type === "choice" && t.liberties && state) {
        const g = groupAt(state.board, state.size, idx(state.size, t.liberties[0], t.liberties[1]));
        expect(t.options[t.answer]).toBe(String(g.liberties.length));
      } else if (t.type === "count") {
        const answer = countAnswer(state, t.measure);
        expect(countOptions(answer)).toContain(answer);
      }
    });
  }
});

describe("lesson move judging", () => {
  it("rejects a non-capturing move on a capture step and accepts the capture", () => {
    const lesson = LESSONS.find((l) => l.id === "capturing")!;
    const step = lesson.steps[0]!;
    const state = lessonStepState(step)!;
    expect(evaluateLessonMove(step, state, 4, 4).kind).toBe("retry");
    expect(evaluateLessonMove(step, state, 2, 1).kind).toBe("success");
  });

  it("counts territory with the engine", () => {
    const lesson = LESSONS.find((l) => l.id === "territory")!;
    const state = lessonStepState(lesson.steps[0]!)!;
    expect(countAnswer(state, "blackTerritory")).toBe(10);
    expect(countAnswer(state, "whiteTerritory")).toBe(5);
    expect(countAnswer(state, "blackArea")).toBe(15);
    expect(countAnswer(state, "whiteArea")).toBe(10);
  });
});
