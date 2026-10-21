import { describe, expect, it } from "vitest";
import type { GameState } from "../src";
import {
  boardFromAscii,
  createFromBoard,
  createGame,
  finishScoring,
  groupAt,
  idx,
  illegalReason,
  legalMoves,
  parseSGF,
  play,
  playOrThrow,
  replaySGF,
  resumePlay,
  score,
  timeout,
  toSGF,
  toggleDead,
} from "../src";

function fromPicture(rows: string[], toPlay: 1 | 2, komi = 0) {
  const { size, board } = boardFromAscii(rows);
  return createFromBoard(size, board, toPlay, komi);
}

describe("basic placement", () => {
  it("alternates colors and rejects occupied points", () => {
    let s = createGame({ size: 9 });
    s = playOrThrow(s, 4, 4);
    expect(s.toPlay).toBe(2);
    expect(s.board[idx(9, 4, 4)]).toBe(1);
    expect(illegalReason(s, 4, 4)).toBe("occupied");
  });

  it("rejects out of bounds", () => {
    const s = createGame({ size: 9 });
    expect(illegalReason(s, -1, 0)).toBe("out-of-bounds");
    expect(illegalReason(s, 0, 9)).toBe("out-of-bounds");
  });

  it("uses default komi per board size", () => {
    expect(createGame({ size: 9 }).komi).toBe(7);
    expect(createGame({ size: 19 }).komi).toBe(7.5);
  });
});

describe("liberties and capture", () => {
  it("counts group liberties", () => {
    const s = fromPicture(["XX...", ".....", ".....", ".....", "....."], 2);
    const g = groupAt(s.board, s.size, 0);
    expect(g.stones.length).toBe(2);
    expect(g.liberties.length).toBe(3);
  });

  it("captures a single stone in the corner", () => {
    const s = fromPicture(["O....", "X....", ".....", ".....", "....."], 1);
    const r = play(s, { kind: "play", x: 1, y: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board[0]).toBe(0);
    expect(r.state.captures.black).toBe(1);
  });

  it("captures a multi-stone group at once", () => {
    const s = fromPicture(["OO...", "XX...", ".....", ".....", "....."], 1);
    const r = play(s, { kind: "play", x: 2, y: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board[0]).toBe(0);
    expect(r.state.board[1]).toBe(0);
    expect(r.state.captures.black).toBe(2);
  });

  it("captures several separate groups with one move", () => {
    const s = fromPicture([".OX..", "OX...", "X....", ".....", "....."], 1);
    const r = play(s, { kind: "play", x: 0, y: 0 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board[idx(5, 1, 0)]).toBe(0);
    expect(r.state.board[idx(5, 0, 1)]).toBe(0);
    expect(r.state.captures.black).toBe(2);
    expect(r.state.moves[0]?.captured).toBe(2);
  });
});

describe("suicide", () => {
  it("rejects a move with no liberties and no capture", () => {
    const t = fromPicture([".O...", "O....", ".....", ".....", "....."], 1);
    expect(illegalReason(t, 0, 0)).toBe("suicide");
  });

  it("allows a move that fills its last liberty only because it captures", () => {
    const s = fromPicture([".XO..", "XO.O.", ".XO..", ".....", "....."], 1);
    const r = play(s, { kind: "play", x: 2, y: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.board[idx(5, 1, 1)]).toBe(0);
    expect(r.state.captures.black).toBe(1);
  });

  it("rejects suicide of a whole multi-stone group", () => {
    // Filling (0,0) joins three black stones whose last liberties are all gone.
    const t = fromPicture([".XO..", "XOO..", "OO...", ".....", "....."], 1);
    expect(illegalReason(t, 0, 0)).toBe("suicide");
  });
});

describe("ko (positional superko)", () => {
  const ko = [".XO..", "XO.O.", ".XO..", ".....", "....."];

  it("forbids the immediate recapture", () => {
    let s = fromPicture(ko, 1);
    s = playOrThrow(s, 2, 1); // black captures the white stone at (1,1)
    expect(s.board[idx(5, 1, 1)]).toBe(0);
    expect(illegalReason(s, 1, 1)).toBe("ko");
  });

  it("allows the recapture after a ko threat exchange", () => {
    let s = fromPicture(ko, 1);
    s = playOrThrow(s, 2, 1); // black takes
    s = playOrThrow(s, 4, 4); // white threat elsewhere
    s = playOrThrow(s, 4, 3); // black answers
    expect(illegalReason(s, 1, 1)).toBeNull();
    s = playOrThrow(s, 1, 1); // white retakes
    expect(s.board[idx(5, 2, 1)]).toBe(0);
    // now black may not retake immediately
    expect(illegalReason(s, 2, 1)).toBe("ko");
  });

  it("excludes ko points from legalMoves", () => {
    let s = fromPicture(ko, 1);
    s = playOrThrow(s, 2, 1);
    expect(legalMoves(s)).not.toContain(idx(5, 1, 1));
  });
});

describe("passing and game end", () => {
  it("two consecutive passes move to the scoring phase", () => {
    let s = createGame({ size: 9 });
    s = playOrThrow(s, 2, 2);
    let r = play(s, { kind: "pass" });
    expect(r.ok && r.state.status).toBe("playing");
    if (!r.ok) return;
    r = play(r.state, { kind: "pass" });
    expect(r.ok && r.state.status).toBe("scoring");
  });

  it("a stone between passes resets the pass count", () => {
    let s = createGame({ size: 9 });
    const a = play(s, { kind: "pass" });
    if (!a.ok) throw new Error("x");
    s = playOrThrow(a.state, 3, 3);
    expect(s.consecutivePasses).toBe(0);
    expect(s.status).toBe("playing");
  });

  it("resign ends the game and the opponent wins", () => {
    const s = createGame({ size: 9 });
    const r = play(s, { kind: "resign" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.status).toBe("finished");
    expect(r.state.result?.winner).toBe(2);
    expect(play(r.state, { kind: "pass" }).ok).toBe(false);
  });

  it("timeout awards the win to the other side", () => {
    const s = timeout(createGame({ size: 9 }), 1);
    expect(s.result?.winner).toBe(2);
    expect(s.result?.reason).toBe("timeout");
  });

  it("resumePlay returns from scoring and clears dead marks", () => {
    let s = createGame({ size: 5 });
    for (let i = 0; i < 2; i++) {
      const r = play(s, { kind: "pass" });
      if (!r.ok) throw new Error("x");
      s = r.state;
    }
    expect(s.status).toBe("scoring");
    s = resumePlay(s);
    expect(s.status).toBe("playing");
    expect(s.consecutivePasses).toBe(0);
  });
});

describe("area scoring", () => {
  it("counts stones plus surrounded territory, with komi to white", () => {
    // Column 2 is a wall: X wall left side, O wall right side.
    const s = fromPicture(
      ["..XO.", "..XO.", "..XO.", "..XO.", "..XO."],
      1,
      0.5,
    );
    const r = score(s);
    expect(r.blackArea).toBe(15); // 5 stones + 10 empty to the left
    expect(r.whiteArea).toBe(10); // 5 stones + 5 empty to the right
    expect(r.whiteScore).toBe(10.5);
    expect(r.winner).toBe(1);
    expect(r.margin).toBe(4.5);
  });

  it("treats empty regions touching both colors as neutral", () => {
    const s = fromPicture(
      ["X.O..", "X.O..", "X.O..", "X.O..", "X.O.."],
      1,
      0,
    );
    const r = score(s);
    expect(r.blackArea).toBe(5); // column of X, middle column is neutral
    expect(r.whiteArea).toBe(5 + 10); // O column plus the two empty columns at right
  });

  it("removes dead stones before counting", () => {
    const s0 = fromPicture(
      ["XXXXX", "XXXXX", "XX.OX", "XXXXX", "XXXXX"],
      1,
      0,
    );
    // Without marking, the lone O is alive and its point is white's.
    expect(score(s0).whiteArea).toBe(1);
    let s: GameState = { ...s0, status: "scoring" };
    s = toggleDead(s, 3, 2);
    const r = score(s);
    expect(r.whiteArea).toBe(0);
    expect(r.blackArea).toBe(25);
    const done = finishScoring(s);
    expect(done.status).toBe("finished");
    expect(done.result?.winner).toBe(1);
  });

  it("toggleDead marks the whole group and toggles back", () => {
    let s: GameState = fromPicture([".....", ".OO..", ".....", ".....", "....."], 1);
    s = { ...s, status: "scoring" };
    s = toggleDead(s, 1, 1);
    expect(s.dead.length).toBe(2);
    s = toggleDead(s, 2, 1);
    expect(s.dead.length).toBe(0);
  });

  it("scores an empty board as a komi win for white", () => {
    const s = createGame({ size: 9 });
    const r = score(s);
    expect(r.blackArea).toBe(0);
    expect(r.winner).toBe(2);
  });
});

describe("SGF", () => {
  it("round trips a game through SGF", () => {
    let s = createGame({ size: 9 });
    s = playOrThrow(s, 2, 2);
    s = playOrThrow(s, 6, 6);
    const passed = play(s, { kind: "pass" });
    if (!passed.ok) throw new Error("x");
    s = passed.state;
    s = playOrThrow(s, 4, 4);

    const sgf = toSGF(s, { black: "Ann", white: "Bo" });
    expect(sgf).toContain("SZ[9]");
    expect(sgf).toContain(";B[cc];W[gg];B[];W[ee]");

    const replayed = replaySGF(sgf);
    expect(replayed.board).toEqual(s.board);
    expect(replayed.moves.length).toBe(4);
  });

  it("parses size, komi and moves", () => {
    const p = parseSGF("(;GM[1]SZ[13]KM[6.5];B[dd];W[jj];B[tt])");
    expect(p.size).toBe(13);
    expect(p.komi).toBe(6.5);
    expect(p.moves.length).toBe(3);
    expect(p.moves[2]?.move.kind).toBe("pass");
  });

  it("reports an illegal move in an SGF", () => {
    expect(() => replaySGF("(;SZ[9];B[aa];W[bb];B[aa])")).toThrow(/illegal/);
  });
});
