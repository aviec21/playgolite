"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { illegalReason, score, toSGF, type GameState } from "@playgolite/engine";
import { REASON_TEXT } from "@playgolite/learn";
import { BackButton } from "./BackButton";
import { Board } from "./Board";
import { ThemeToggle } from "./ThemeToggle";
import { COLUMN_LETTERS } from "../lib/geometry";
import { addGame, listGames } from "../lib/gameStore";
import { ApiError, api, useMe } from "../lib/onlineClient";
import {
  MAX_RESUMES,
  describeTime,
  formatClock,
  remainingMs,
  replayMoves,
  type OnlineGame,
} from "../lib/onlineShared";
import { copyText } from "../lib/sgfFile";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function describeResult(re: string | null, names: { black: string; white: string }): string {
  if (!re) return "";
  if (re === "0") return "Draw";
  const m = /^([BW])\+(.*)$/.exec(re);
  if (!m) return re;
  const who = m[1] === "B" ? names.black : names.white;
  return m[2] === "R" ? `${who} wins by resignation` : m[2] === "T" ? `${who} wins on time` : `${who} wins by ${m[2]} points`;
}

export function OnlineGameScreen({ id }: { id: string }) {
  const { user } = useMe();
  const [game, setGame] = useState<OnlineGame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; warn: boolean } | null>(null);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [archivedId, setArchivedId] = useState<string | null>(null);
  const offset = useRef(0);
  const rev = useRef(-1);
  const gameRef = useRef<OnlineGame | null>(null);
  gameRef.current = game;

  const apply = useCallback((g: OnlineGame) => {
    offset.current = g.serverNow - Date.now();
    rev.current = g.rev;
    setGame(g);
    setPending(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ game?: OnlineGame; unchanged?: boolean; serverNow: number }>(`/api/games/${id}?rev=${rev.current}`);
      if (r.game) apply(r.game);
      else offset.current = r.serverNow - Date.now();
      setError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setError("This game does not exist, or the invite was cancelled.");
      else if (!gameRef.current) setError(e instanceof ApiError ? e.message : "Could not load the game.");
    }
  }, [id, apply]);

  // Polling: quick while a live game is moving, slow for daily games and background tabs.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      if (stopped) return;
      await refresh();
      const g = gameRef.current;
      if (stopped || (g && g.status === "finished")) return;
      let delay = 3000;
      if (g) {
        if (g.tc.kind === "daily" && g.status !== "scoring") delay = 10_000;
        else if (g.status === "playing" && g.you === g.toPlay) delay = 5000;
        else delay = 2000;
      }
      if (document.visibilityState === "hidden") delay = Math.max(delay, 15_000);
      timer = setTimeout(loop, delay);
    };
    void loop();
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        void loop();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  // Clock tick.
  const playing = game?.status === "playing" || game?.status === "scoring";
  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setNow(Date.now() + offset.current), 250);
    return () => clearInterval(t);
  }, [playing]);

  const state: GameState | null = useMemo(() => {
    if (!game || game.status === "open") return null;
    try {
      return { ...replayMoves(game.size, game.komi, game.moves), dead: game.dead };
    } catch {
      return null;
    }
  }, [game]);

  // If a clock looks empty, ask the server to settle it.
  const lastNudge = useRef(0);
  useEffect(() => {
    if (!game || game.status !== "playing") return;
    const left = remainingMs(game, game.toPlay, now);
    if (left <= 0 && Date.now() - lastNudge.current > 1500) {
      lastNudge.current = Date.now();
      void refresh();
    }
  }, [now, game, refresh]);

  const names = { black: game?.black?.username ?? "Black", white: game?.white?.username ?? "White" };

  // Keep finished games on this device for review, once.
  useEffect(() => {
    if (!game || game.status !== "finished" || !game.you || !state || archivedId) return;
    const key = `online:${game.id}`;
    const existing = listGames().find((g) => g.sgf.includes(`GN[${key}]`));
    if (existing) {
      setArchivedId(existing.id);
      return;
    }
    let sgf = toSGF({ size: state.size, komi: state.komi, moves: state.moves }, {
      black: names.black,
      white: names.white,
      date: new Date(game.finishedAt ?? Date.now()).toISOString().slice(0, 10),
    });
    sgf = sgf.replace(/KM\[[^\]]*\]/, (m) => `${m}GN[${key}]${game.result ? `RE[${game.result}]` : ""}`);
    const entry = addGame({
      sgf,
      black: names.black,
      white: names.white,
      result: game.result ?? "",
      size: game.size,
      moves: state.moves.length,
      source: "played",
    });
    setArchivedId(entry.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.status, state]);

  const send = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ game: OnlineGame }>(`/api/games/${id}/act`, "POST", body);
      apply(r.game);
    } catch (e) {
      if (e instanceof ApiError && e.code === "stale") await refresh();
      setMessage({ text: e instanceof ApiError ? e.message : "Something went wrong.", warn: true });
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const join = async () => {
    setBusy(true);
    try {
      const r = await api<{ game: OnlineGame }>(`/api/games/${id}/join`, "POST", {});
      apply(r.game);
    } catch (e) {
      setMessage({ text: e instanceof ApiError ? e.message : "Could not join.", warn: true });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const myTurn = !!game && game.status === "playing" && game.you === game.toPlay;

  const onPoint = (x: number, y: number) => {
    if (!game || !state || busy) return;
    if (game.status === "scoring" && game.you) {
      void send({ type: "mark", x, y });
      return;
    }
    if (!myTurn) return;
    const why = illegalReason(state, x, y);
    if (why) {
      setMessage({ text: REASON_TEXT[why], warn: true });
      return;
    }
    setMessage(null);
    if (pending && pending.x === x && pending.y === y) void send({ type: "move", x, y, expect: game.moveCount });
    else setPending({ x, y });
  };

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/g/${id}` : `/g/${id}`;

  const moveRows = useMemo(() => {
    if (!state) return [];
    const rows: Array<{ n: number; a: string; b: string }> = [];
    const label = (i: number) => {
      const m = state.moves[i]?.move;
      if (!m) return "";
      return m.kind === "play" ? `${COLUMN_LETTERS[m.x]}${state.size - m.y}` : "Pass";
    };
    for (let i = 0; i < state.moves.length; i += 2) rows.push({ n: i / 2 + 1, a: label(i), b: label(i + 1) });
    return rows;
  }, [state]);
  const moveListRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moveListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moveRows.length]);

  const scoreNow = useMemo(
    () => (state && (game?.status === "scoring" || (game?.status === "finished" && state.status === "scoring")) ? score(state) : null),
    [state, game?.status],
  );

  const header = (
    <div className="topbar">
      <div className="topbar-left">
        <BackButton href="/online" label="Online" />
        <Link href="/" className="wordmark">
          <span className="dot" aria-hidden />
          PlayGoLite
        </Link>
      </div>
      <ThemeToggle />
    </div>
  );

  if (error && !game) {
    return (
      <main className="shell">
        {header}
        <div className="card stack">
          <h1>Game not found</h1>
          <p>{error}</p>
          <Link href="/online" className="btn primary" style={{ textAlign: "center" }}>
            Back to online play
          </Link>
        </div>
      </main>
    );
  }
  if (!game) {
    return (
      <main className="shell">
        {header}
        <p>Loading...</p>
      </main>
    );
  }

  // Waiting for an opponent.
  if (game.status === "open") {
    const mine = user && game.creator.id === user.id;
    return (
      <main className="shell">
        {header}
        <div className="card stack" style={{ maxWidth: 520 }}>
          <h1>
            {game.size} x {game.size} game
          </h1>
          <p>
            {describeTime(game.tc)} &middot; created by {game.creator.username} ({game.creator.rating}) &middot; they play{" "}
            {game.creatorColor === "random" ? "a random colour" : game.creatorColor}
          </p>
          {mine ? (
            <>
              <p>Send this link to your opponent. This page updates by itself when they join.</p>
              <input readOnly value={inviteUrl} onFocus={(e) => e.currentTarget.select()} style={{ font: "inherit", padding: 12, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg)", color: "var(--text)" }} />
              <div className="row">
                <button
                  className="btn primary grow"
                  onClick={async () => {
                    setCopied(await copyText(inviteUrl));
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? "Copied" : "Copy link"}
                </button>
                <button
                  className="btn danger grow"
                  onClick={async () => {
                    try {
                      await api(`/api/games/${id}`, "DELETE");
                      window.location.href = "/online";
                    } catch (e) {
                      setMessage({ text: e instanceof ApiError ? e.message : "Could not cancel.", warn: true });
                    }
                  }}
                >
                  Cancel game
                </button>
              </div>
            </>
          ) : user ? (
            <button className="btn primary" onClick={join} disabled={busy}>
              {busy ? "Joining..." : "Join this game"}
            </button>
          ) : user === null ? (
            <Link href={`/account?next=/g/${id}`} className="btn primary" style={{ textAlign: "center" }}>
              Sign in to join
            </Link>
          ) : (
            <p>Loading...</p>
          )}
          {message && <div className={`message ${message.warn ? "warn" : ""}`}>{message.text}</div>}
        </div>
      </main>
    );
  }

  if (!state) {
    return (
      <main className="shell">
        {header}
        <div className="card">This game record could not be read.</div>
      </main>
    );
  }

  const clockFor = (c: "black" | "white") => {
    const ms = remainingMs(game, c, now);
    const text = formatClock(ms, game.tc.kind);
    const low = game.tc.kind === "live" && ms < 30_000 && game.status === "playing";
    return <span className={`clock ${low ? "low" : ""}`}>{text}</span>;
  };
  const youLabel = (c: "black" | "white") => (game.you === c ? " (you)" : "");
  const watching = game.you === null;
  const opp = game.you === "black" ? names.white : names.black;
  const lastWasPass = state.moves[state.moves.length - 1]?.move.kind === "pass";
  const deadline = game.scoringDeadline;
  const mm = (ms: number) => formatClock(ms, ms > 3_600_000 ? "daily" : "live");

  const status =
    game.status === "playing"
      ? myTurn
        ? lastWasPass
          ? `Your turn. ${opp} passed.`
          : "Your turn"
        : watching
          ? `${game.toPlay === "black" ? names.black : names.white} to play`
          : `Waiting for ${opp}`
      : "";

  return (
    <main className="shell">
      {header}
      <div className="game-layout">
        <div className="game-main">
          <div className="statusbar">
            {(["black", "white"] as const).map((c) => (
              <div key={c} className={`player ${game.toPlay === c && game.status === "playing" ? "active" : ""}`}>
                <span className={`stone ${c}`} />
                <span>
                  {names[c]}
                  {youLabel(c)} <small>{(c === "black" ? game[c]?.rating : game[c]?.rating) ?? ""}</small>
                </span>
                {game.status !== "finished" && <span style={{ marginLeft: "auto" }}>{clockFor(c)}</span>}
              </div>
            ))}
          </div>
          <Board
            state={state}
            pending={pending}
            koPoint={null}
            territory={scoreNow?.owner ?? null}
            showCoordinates={false}
            onPoint={onPoint}
          />
        </div>

        <div className="game-side">
          {game.status === "playing" && (
            <div className="panel">
              <div className={`message ${message?.warn ? "warn" : ""}`} aria-live="polite">
                {message?.text ?? status}
              </div>
              {game.you && (
                <div className="row">
                  <button
                    className="btn primary grow"
                    disabled={!myTurn || !pending || busy}
                    onClick={() => pending && void send({ type: "move", x: pending.x, y: pending.y, expect: game.moveCount })}
                  >
                    {pending ? `Play ${COLUMN_LETTERS[pending.x]}${game.size - pending.y}` : "Tap the board"}
                  </button>
                  <button className="btn grow" disabled={!myTurn || busy} onClick={() => void send({ type: "pass", expect: game.moveCount })}>
                    Pass
                  </button>
                  <button
                    className="btn danger grow"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Resign this game?")) void send({ type: "resign" });
                    }}
                  >
                    Resign
                  </button>
                </div>
              )}
              <small style={{ color: "var(--muted)", textAlign: "center" }}>
                {game.size} x {game.size} &middot; {describeTime(game.tc)} &middot; komi {fmt(game.komi)}
              </small>
            </div>
          )}

          {game.status === "scoring" && scoreNow && (
            <div className="card stack">
              <h2>Mark dead stones</h2>
              <p>
                Both players passed. {game.you ? "Tap any dead group to remove it from the count, and tap again to bring it back. Changing anything resets both players' agreement." : "The players are agreeing on the score."}
              </p>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span>
                  <strong>{names.black}</strong> {fmt(scoreNow.blackScore)}
                </span>
                <span>
                  <strong>{names.white}</strong> {fmt(scoreNow.whiteScore)}{" "}
                  <small style={{ color: "var(--muted)" }}>(incl. {fmt(game.komi)} komi)</small>
                </span>
              </div>
              <small style={{ color: "var(--muted)" }}>
                Agreed: {game.acceptBlack ? names.black : ""}
                {game.acceptBlack && game.acceptWhite ? ", " : ""}
                {game.acceptWhite ? names.white : ""}
                {!game.acceptBlack && !game.acceptWhite ? "nobody yet" : ""}
                {deadline ? ` · auto-finishes in ${mm(Math.max(0, deadline - now))}` : ""}
              </small>
              {message && <div className={`message ${message.warn ? "warn" : ""}`}>{message.text}</div>}
              {game.you && (
                <div className="row">
                  <button
                    className="btn primary grow"
                    disabled={busy || (game.you === "black" ? game.acceptBlack : game.acceptWhite)}
                    onClick={() => void send({ type: "accept" })}
                  >
                    {(game.you === "black" ? game.acceptBlack : game.acceptWhite) ? "Waiting for opponent" : "Accept score"}
                  </button>
                  <button className="btn grow" disabled={busy || game.resumes >= MAX_RESUMES} onClick={() => void send({ type: "resume" })}>
                    Keep playing
                  </button>
                </div>
              )}
            </div>
          )}

          {game.status === "finished" && (
            <div className="card stack">
              <div className="result">{describeResult(game.result, names)}</div>
              {scoreNow && game.result && /^[BW]\+\d/.test(game.result) && (
                <p style={{ textAlign: "center" }}>
                  {names.black} {fmt(scoreNow.blackScore)} to {names.white} {fmt(scoreNow.whiteScore)} (area scoring)
                </p>
              )}
              <div className="row">
                <Link href="/online" className="btn primary grow" style={{ textAlign: "center" }}>
                  Online lobby
                </Link>
                {archivedId && (
                  <Link href={`/review?id=${archivedId}`} className="btn grow" style={{ textAlign: "center" }}>
                    Review
                  </Link>
                )}
              </div>
            </div>
          )}

          <div className="panel desktop-only">
            <h2>Moves</h2>
            <div className="movelist" ref={moveListRef}>
              {moveRows.length === 0 && <p>No moves yet.</p>}
              {moveRows.map((r, i) => (
                <div className="mv" key={r.n}>
                  <span>{r.n}</span>
                  <span className={i === moveRows.length - 1 && !r.b ? "last" : ""}>{r.a}</span>
                  <span className={i === moveRows.length - 1 && r.b ? "last" : ""}>{r.b}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

