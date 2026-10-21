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
import type { Level } from "@playgolite/ai";
import { computeDead, computeMove } from "../lib/aiClient";
import { BackButton } from "./BackButton";
import { Board } from "./Board";
import { ThemeToggle } from "./ThemeToggle";

export const SAVE_KEY = "playgolite:local-game";
/** "Undo 5" rewinds this many moves of each side. */
const REWIND_STEPS = 5;
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

export interface AiConfig {
  level: Level;
  /** Colour played by the person: 1 Black, 2 White. */
  human: number;
}

const LEVEL_NAMES: Record<Level, string> = {
  beginner: "Beginner",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  expert: "Expert",
};

export function GameScreen({ size, resume, ai }: { size: number; resume: boolean; ai: AiConfig | null }) {
  const [aiCfg, setAiCfg] = useState<AiConfig | null>(ai);
  const aiToken = useRef(0);
  const scoredFor = useRef(-1);
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
        if (saved) {
          let sgf = saved;
          if (saved.trimStart().startsWith("{")) {
            const payload = JSON.parse(saved) as { sgf: string; ai?: AiConfig | null };
            sgf = payload.sgf;
            setAiCfg(payload.ai ?? null);
          }
          setHistory([replaySGF(sgf)]);
        }
      }
      // A new game only replaces the saved one when its first move is made, so opening this
      // page again (for example with the browser Back button) never wipes a saved game.
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
        localStorage.setItem(SAVE_KEY, JSON.stringify({ sgf: toSGF(state), ai: aiCfg }));
      }
    } catch {
      /* storage may be unavailable */
    }
  }, [state, aiCfg]);

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

  const aiTurn = aiCfg !== null && state.status === "playing" && state.toPlay !== aiCfg.human;

  // The computer moves when it is its turn. Any change of position cancels a search in flight.
  useEffect(() => {
    if (!aiCfg || !loaded.current || state.status !== "playing" || state.toPlay === aiCfg.human) return;
    const token = ++aiToken.current;
    const started = Date.now();
    computeMove(state, aiCfg.level)
      .then(async (c) => {
        const wait = Math.max(0, 450 - (Date.now() - started));
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (token !== aiToken.current) return;
        const r = play(state, c.move);
        if (r.ok) push(r.state);
        else {
          const p = play(state, { kind: "pass" });
          if (p.ok) push(p.state);
        }
      })
      .catch(() => {
        /* a failed search leaves the turn with the computer; Undo or Menu still work */
      });
    return () => {
      aiToken.current++;
    };
  }, [state, aiCfg, push]);

  // Against the computer, pre-mark the stones it judges dead. The player can still correct them.
  useEffect(() => {
    if (!aiCfg || state.status !== "scoring" || scoredFor.current === state.moves.length) return;
    scoredFor.current = state.moves.length;
    const snapshot = state;
    computeDead(snapshot)
      .then((dead) => {
        setHistory((h) => {
          let cur = h[h.length - 1] as GameState;
          if (cur !== snapshot) return h;
          for (const p of dead) cur = toggleDead(cur, p % cur.size, Math.floor(p / cur.size));
          return [...h.slice(0, -1), cur];
        });
      })
      .catch(() => {
        /* marking by hand still works */
      });
  }, [state, aiCfg]);

  const onPoint = useCallback(
    (x: number, y: number) => {
      if (aiTurn) return;
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
    [state, confirmMoves, pending, place, aiTurn],
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

  const restart = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage may be unavailable */
    }
    aiToken.current++;
    scoredFor.current = -1;
    setHistory([createGame({ size })]);
    setPending(null);
    setMessage(null);
  };

  /** Take back `steps` turns: one move without a computer, otherwise one of the person's moves plus the reply. */
  const undo = (steps = 1) => {
    aiToken.current++;
    setHistory((h) => {
      let end = h.length - 1;
      for (let i = 0; i < steps && end > 0; i++) {
        // Two players: a single undo takes back one move, "Undo 5" takes back 5 moves of each side.
        if (!aiCfg) end = Math.max(0, end - (steps > 1 ? 2 : 1));
        else {
          do {
            end--;
          } while (end > 0 && (h[end] as GameState).toPlay !== aiCfg.human);
        }
      }
      return end === h.length - 1 ? h : h.slice(0, end + 1);
    });
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

  // A game is "in progress" once a move has been made and it is not over. It is saved on this
  // device after every move, so leaving does not lose it, but starting another game replaces it.
  const inProgress = state.moves.length > 0 && state.status !== "finished";
  const leaveWarning = inProgress
    ? "Leave this game? It is saved on this device, so you can continue it from the home screen. Starting a new game there will replace it."
    : null;
  const warnRef = useRef<string | null>(null);
  warnRef.current = leaveWarning;

  // Guard the browser or phone Back gesture and closing the tab while a game is in progress.
  useEffect(() => {
    let active = true;
    window.history.pushState({ playgolite: "guard" }, "", window.location.href);
    const onPop = () => {
      if (!active) return;
      const msg = warnRef.current;
      if (msg && !window.confirm(msg)) {
        // Stay: put the guard entry back.
        window.history.pushState({ playgolite: "guard" }, "", window.location.href);
        return;
      }
      active = false;
      window.history.back();
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (warnRef.current) e.preventDefault();
    };
    window.addEventListener("popstate", onPop);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      active = false;
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  return (
    <main className="shell">
      <div className="topbar">
        <div className="topbar-left">
          <BackButton href="/" label="Home" warn={leaveWarning} />
          <span className="wordmark">
            <span className="dot" aria-hidden />
            PlayGoLite
          </span>
        </div>
        <ThemeToggle />
      </div>

      <div className="statusbar">
        <div className={`player ${state.toPlay === 1 && state.status === "playing" ? "active" : ""}`}>
          <span className="stone black" />
          Black{aiCfg ? (aiCfg.human === 1 ? " (you)" : " (computer)") : ""} <small>{state.captures.black} captured</small>
        </div>
        <div className={`player ${state.toPlay === 2 && state.status === "playing" ? "active" : ""}`}>
          <span className="stone white" />
          White{aiCfg ? (aiCfg.human === 2 ? " (you)" : " (computer)") : ""} <small>{state.captures.white} captured</small>
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
            {aiTurn
              ? `Computer (${LEVEL_NAMES[aiCfg?.level ?? "easy"]}) is thinking...`
              : (message?.text ?? (lastWasPass ? `${turnLabel} to play. The opponent passed.` : `${turnLabel} to play`))}
          </div>
          <div className="row">
            <button
              className="btn primary grow"
              disabled={!pending || aiTurn}
              onClick={() => pending && place(pending.x, pending.y)}
            >
              Confirm
            </button>
            <button className="btn grow" onClick={doPass} disabled={aiTurn}>
              Pass
            </button>
            <button className="btn grow" onClick={() => undo()} disabled={history.length < 2 || (aiCfg !== null && aiCfg.human === 2 && history.length < 3)}>
              Undo
            </button>
          </div>
          <div className="row">
            <button
              className="btn grow"
              onClick={() => undo(REWIND_STEPS)}
              disabled={history.length < 3}
              title="Take back 5 moves of each side"
            >
              Undo 5
            </button>
            <button className="btn danger grow" onClick={doResign}>
              Resign
            </button>
            <Link
              href="/"
              className="btn grow"
              style={{ textAlign: "center" }}
              onClick={(e) => {
                if (leaveWarning && !window.confirm(leaveWarning)) e.preventDefault();
              }}
            >
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
            <button className="btn primary grow" onClick={restart}>
              Play again
            </button>
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
