"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createGame,
  finishScoring,
  idx,
  illegalReason,
  play,
  replaySGF,
  resumePlay,
  score,
  toSGF,
  toggleDead,
  type GameState,
  type IllegalReason,
} from "@playgolite/engine";
import { Board } from "./Board";
import { ThemeToggle } from "./ThemeToggle";

export const SAVE_KEY = "playgolite:local-game";
const SETTINGS_KEY = "playgolite:settings";

const REASONS: Record<IllegalReason, string> = {
  "game-over": "The game is over.",
  "out-of-bounds": "That point is off the board.",
  occupied: "That point is taken.",
  suicide: "Not allowed: that move would leave your stones with no liberties.",
  ko: "Not allowed: ko. Play elsewhere first, then you can retake.",
};

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function describeResult(state: GameState): string {
  const r = state.result;
  if (!r) return "";
  const who = r.winner === 1 ? "Black" : r.winner === 2 ? "White" : "Nobody";
  if (r.reason === "resign") return `${who} wins by resignation`;
  if (r.reason === "timeout") return `${who} wins on time`;
  if (r.winner === null) return "Draw";
  return `${who} wins by ${fmt(r.margin)}`;
}

export function GameScreen({ size, resume }: { size: number; resume: boolean }) {
  const [history, setHistory] = useState<GameState[]>(() => [createGame({ size })]);
  const [pending, setPending] = useState<{ x: number; y: number } | null>(null);
  const [message, setMessage] = useState<{ text: string; warn: boolean } | null>(null);
  const [confirmMoves, setConfirmMoves] = useState(true);
  const [coords, setCoords] = useState(false);
  const loaded = useRef(false);

  const state = history[history.length - 1] as GameState;

  // Load saved settings and, when asked, the saved game. Runs once on the client.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    try {
      const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") as {
        confirmMoves?: boolean;
        coords?: boolean;
      };
      if (typeof s.confirmMoves === "boolean") setConfirmMoves(s.confirmMoves);
      if (typeof s.coords === "boolean") setCoords(s.coords);
    } catch {
      /* ignore bad settings */
    }
    try {
      if (resume) {
        const saved = localStorage.getItem(SAVE_KEY);
        if (saved) setHistory([replaySGF(saved)]);
      } else {
        // Starting a new game replaces whatever was saved before.
        localStorage.removeItem(SAVE_KEY);
      }
    } catch {
      /* a corrupt save just starts a fresh game */
    }
  }, [resume]);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ confirmMoves, coords }));
    } catch {
      /* storage may be unavailable */
    }
  }, [confirmMoves, coords]);

  // Save the game after every change. A finished game is cleared from the slot.
  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (state.moves.length === 0) return;
      if (state.status === "finished") {
        localStorage.removeItem(SAVE_KEY);
      } else {
        localStorage.setItem(SAVE_KEY, toSGF(state));
      }
    } catch {
      /* storage may be unavailable */
    }
  }, [state]);

  const push = useCallback((next: GameState) => {
    setHistory((h) => [...h, next]);
    setPending(null);
    setMessage(null);
  }, []);

  const place = useCallback(
    (x: number, y: number) => {
      const r = play(state, { kind: "play", x, y });
      if (r.ok) push(r.state);
      else setMessage({ text: REASONS[r.reason], warn: true });
    },
    [state, push],
  );

  const onPoint = useCallback(
    (x: number, y: number) => {
      if (state.status === "scoring") {
        setHistory((h) => [...h.slice(0, -1), toggleDead(h[h.length - 1] as GameState, x, y)]);
        return;
      }
      if (state.status !== "playing") return;
      const reason = illegalReason(state, x, y);
      if (reason) {
        setPending(null);
        setMessage({ text: REASONS[reason], warn: true });
        return;
      }
      if (!confirmMoves || (pending && pending.x === x && pending.y === y)) {
        place(x, y);
      } else {
        setPending({ x, y });
        setMessage({ text: "Tap the stone again or press Confirm to place it.", warn: false });
      }
    },
    [state, confirmMoves, pending, place],
  );

  const doPass = () => {
    const r = play(state, { kind: "pass" });
    if (r.ok) push(r.state);
  };

  const doResign = () => {
    if (!window.confirm("Resign this game?")) return;
    const r = play(state, { kind: "resign" });
    if (r.ok) push(r.state);
  };

  const undo = () => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
    setPending(null);
    setMessage(null);
  };

  const koPoint = useMemo(() => {
    const prev = history[history.length - 2];
    const last = state.moves[state.moves.length - 1];
    if (!prev || !last || last.captured !== 1 || state.status !== "playing") return null;
    for (let i = 0; i < state.board.length; i++) {
      if (prev.board[i] !== 0 && state.board[i] === 0) {
        const x = i % state.size;
        const y = Math.floor(i / state.size);
        return illegalReason(state, x, y) === "ko" ? idx(state.size, x, y) : null;
      }
    }
    return null;
  }, [history, state]);

  const scoreNow = useMemo(
    () => (state.status === "scoring" || state.status === "finished" ? score(state) : null),
    [state],
  );

  const turnLabel = state.toPlay === 1 ? "Black" : "White";
  const lastWasPass = state.moves[state.moves.length - 1]?.move.kind === "pass";

  return (
    <main className="shell">
      <div className="topbar">
        <Link href="/" className="wordmark">
          <span className="dot" aria-hidden />
          PlayGoLite
        </Link>
        <ThemeToggle />
      </div>

      <div className="statusbar">
        <div className={`player ${state.toPlay === 1 && state.status === "playing" ? "active" : ""}`}>
          <span className="stone black" />
          Black <small>{state.captures.black} captured</small>
        </div>
        <div className={`player ${state.toPlay === 2 && state.status === "playing" ? "active" : ""}`}>
          <span className="stone white" />
          White <small>{state.captures.white} captured</small>
        </div>
      </div>

      <Board
        state={state}
        pending={pending}
        koPoint={koPoint}
        territory={state.status === "scoring" || state.status === "finished" ? (scoreNow?.owner ?? null) : null}
        showCoordinates={coords}
        onPoint={onPoint}
      />

      {state.status === "playing" && (
        <>
          <div className={`message ${message?.warn ? "warn" : ""}`} aria-live="polite">
            {message?.text ?? (lastWasPass ? `${turnLabel} to play. The opponent passed.` : `${turnLabel} to play`)}
          </div>
          <div className="row">
            <button
              className="btn primary grow"
              disabled={!pending}
              onClick={() => pending && place(pending.x, pending.y)}
            >
              Confirm
            </button>
            <button className="btn grow" onClick={doPass}>
              Pass
            </button>
            <button className="btn grow" onClick={undo} disabled={history.length < 2}>
              Undo
            </button>
          </div>
          <div className="row">
            <button className="btn danger grow" onClick={doResign}>
              Resign
            </button>
            <Link href="/" className="btn grow" style={{ textAlign: "center" }}>
              Menu
            </Link>
          </div>
        </>
      )}

      {state.status === "scoring" && scoreNow && (
        <div className="card stack">
          <h2>Mark dead stones</h2>
          <p>
            Both players passed. Tap any group that is dead to remove it from the count. Tap it again to bring it back.
          </p>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span>
              <strong>Black</strong> {fmt(scoreNow.blackScore)}
            </span>
            <span>
              <strong>White</strong> {fmt(scoreNow.whiteScore)} <small style={{ color: "var(--muted)" }}>(incl. {fmt(state.komi)} komi)</small>
            </span>
          </div>
          <div className="row">
            <button className="btn primary grow" onClick={() => push(finishScoring(state))}>
              Accept score
            </button>
            <button className="btn grow" onClick={() => push(resumePlay(state))}>
              Keep playing
            </button>
          </div>
        </div>
      )}

      {state.status === "finished" && (
        <div className="card stack">
          <div className="result">{describeResult(state)}</div>
          {scoreNow && state.result?.reason === "score" && (
            <p style={{ textAlign: "center" }}>
              Black {fmt(scoreNow.blackScore)} to White {fmt(scoreNow.whiteScore)} (area scoring)
            </p>
          )}
          <div className="row">
            <Link href={`/play?size=${state.size}`} className="btn primary grow" style={{ textAlign: "center" }}>
              Play again
            </Link>
            <Link href="/" className="btn grow" style={{ textAlign: "center" }}>
              Menu
            </Link>
          </div>
        </div>
      )}

      <div className="row" style={{ justifyContent: "center", gap: 20 }}>
        <label className="toggle">
          <input type="checkbox" checked={confirmMoves} onChange={(e) => setConfirmMoves(e.target.checked)} />
          Confirm moves
        </label>
        <label className="toggle">
          <input type="checkbox" checked={coords} onChange={(e) => setCoords(e.target.checked)} />
          Coordinates
        </label>
      </div>
    </main>
  );
}
