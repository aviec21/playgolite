import { beforeAll, describe, expect, it } from "vitest";
import { login, recover, register, verifyPassword, hashPassword } from "../lib/server/auth";
import { act, cancelGame, createGame, getGame, joinGame, listGames } from "../lib/server/games";
import { query } from "../lib/server/db";
import { HttpError } from "../lib/server/http";

const fail = async (p: Promise<unknown>, status: number) => {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    return;
  }
  throw new Error("expected failure");
};

describe("accounts", () => {
  it("hashes and verifies passwords", async () => {
    const h = await hashPassword("correct horse");
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("registers, logs in, rejects bad input and duplicates", async () => {
    const r = await register("Alice_1", "password123", "ip-a");
    expect(r.recoveryCodes).toHaveLength(8);
    await fail(register("alice_1", "password123", "ip-a"), 409);
    await fail(register("x", "password123", "ip-a"), 400);
    await fail(register("Bobby", "short", "ip-a"), 400);
    const l = await login("ALICE_1", "password123", "ip-l");
    expect(l.user.username).toBe("Alice_1");
    await fail(login("alice_1", "nope-nope", "ip-l"), 401);
    await fail(login("ghost", "nope-nope", "ip-l"), 401);
  });

  it("recovers with a code once only", async () => {
    const r = await register("Carol", "password123", "ip-c");
    const code = r.recoveryCodes[0]!;
    const out = await recover("carol", code.toUpperCase(), "newpassword1", "ip-c");
    expect(out.codesLeft).toBe(7);
    await fail(recover("carol", code, "another-pass1", "ip-c"), 401);
    await login("carol", "newpassword1", "ip-c");
    await fail(login("carol", "password123", "ip-c"), 401);
  });

  it("rate limits repeated failures", async () => {
    await register("Dave", "password123", "ip-d");
    for (let i = 0; i < 8; i++) await login("dave", "bad-bad-bad", "ip-dd").catch(() => {});
    await fail(login("dave", "password123", "ip-dd"), 429);
  });
});

describe("online games", () => {
  let a: Awaited<ReturnType<typeof register>>["user"];
  let b: typeof a;
  let c: typeof a;
  beforeAll(async () => {
    a = (await register("Anna", "password123", "ip-g1")).user;
    b = (await register("Ben", "password123", "ip-g2")).user;
    c = (await register("Cyrus", "password123", "ip-g3")).user;
  });

  it("plays a full game: join, moves, passes, scoring, finish", async () => {
    const g = await createGame(a, { size: 9, color: "black", time: "live-5-3" });
    expect(g.status).toBe("open");
    await fail(joinGame(a, g.id), 400);
    expect((await listGames(b, "open")).some((x) => x.id === g.id)).toBe(true);
    const j = await joinGame(b, g.id);
    expect(j.status).toBe("playing");
    expect(j.black?.username).toBe("Anna");
    await fail(joinGame(c, g.id), 409);

    await fail(act(b, g.id, { type: "move", x: 2, y: 2, expect: 0 }), 409); // not b's turn
    let s = await act(a, g.id, { type: "move", x: 2, y: 2, expect: 0 });
    expect(s.moves).toEqual(["cc"]);
    expect(s.toPlay).toBe("white");
    await fail(act(b, g.id, { type: "move", x: 2, y: 2, expect: 1 }), 400); // occupied
    await fail(act(c, g.id, { type: "pass", expect: 1 }), 403);
    s = await act(b, g.id, { type: "move", x: 6, y: 6, expect: 1 });
    s = await act(a, g.id, { type: "pass", expect: 2 });
    s = await act(b, g.id, { type: "pass", expect: 3 });
    expect(s.status).toBe("scoring");
    s = await act(a, g.id, { type: "mark", x: 6, y: 6 });
    expect(s.dead).toEqual([6 * 9 + 6]);
    s = await act(a, g.id, { type: "accept" });
    expect(s.status).toBe("scoring");
    s = await act(b, g.id, { type: "mark", x: 6, y: 6 }); // un-mark clears accepts
    expect(s.acceptBlack).toBe(false);
    s = await act(b, g.id, { type: "mark", x: 6, y: 6 });
    s = await act(a, g.id, { type: "accept" });
    s = await act(b, g.id, { type: "accept" });
    expect(s.status).toBe("finished");
    expect(s.result).toMatch(/^B\+\d/);
    await fail(act(a, g.id, { type: "pass", expect: 4 }), 409);
  });

  it("supports resuming play and resigning", async () => {
    const g = await createGame(a, { size: 9, color: "white", time: "daily-1" });
    await joinGame(b, g.id); // b is black
    await act(b, g.id, { type: "pass", expect: 0 });
    let s = await act(a, g.id, { type: "pass", expect: 1 });
    expect(s.status).toBe("scoring");
    s = await act(b, g.id, { type: "resume" });
    expect(s.status).toBe("playing");
    expect(getTurn(s)).toBe("black");
    s = await act(b, g.id, { type: "move", x: 4, y: 4, expect: s.moveCount });
    s = await act(a, g.id, { type: "resign" });
    expect(s.status).toBe("finished");
    expect(s.result).toBe("B+R");
  });

  it("flags a player whose clock runs out", async () => {
    const g = await createGame(a, { size: 9, color: "black", time: "live-5-3" });
    await joinGame(b, g.id);
    await query(`UPDATE pgl_games SET turn_started_at = $1 WHERE id = $2`, [Date.now() - 10 * 60_000, g.id]);
    const s = await getGame(g.id, a.id);
    expect(s.status).toBe("finished");
    expect(s.result).toBe("W+T");
  });

  it("lets only the creator cancel an open game", async () => {
    const g = await createGame(a, { size: 13, color: "random", time: "daily-3" });
    await fail(cancelGame(b, g.id), 403);
    await cancelGame(a, g.id);
    await fail(getGame(g.id, a.id), 404);
  });
});

function getTurn(g: { toPlay: string }) {
  return g.toPlay;
}
