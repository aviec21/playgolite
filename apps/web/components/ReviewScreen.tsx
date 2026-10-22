"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { replaySGFStates, toSGF, type GameState } from "@playgolite/engine";
import { COLUMN_LETTERS } from "../lib/geometry";
import { describeSgfResult, getGame, removeGame, type SavedGame } from "../lib/gameStore";
import { copyText, downloadText, sgfFilename } from "../lib/sgfFile";
import { SAVE_KEY } from "./GameScreen";
import { BackButton } from "./BackButton";
import { Board } from "./Board";
import { ThemeToggle } from "./ThemeToggle";

function label(state: GameState, i: number): string {
  const m = state.moves[i]?.move;
  if (!m) return "";
  if (m.kind === "play") return `${COLUMN_LETTERS[m.x]}${state.size - m.y}`;
  return m.kind === "pass" ? "Pass" : "Resign";
}

export function ReviewScreen({ id }: { id: string }) {
  const router = useRouter();
  const [game, setGame] = useState<SavedGame | null | undefined>(undefined);
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState(false);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setGame(getGame(id));
  }, [id]);

  const replay = useMemo(() => {
    if (!game) return null;
    try {
      const r = replaySGFStates(game.sgf);
      return { states: r.states, parsed: r.parsed, error: null as string | null };
    } catch (e) {
      return { states: [] as GameState[], parsed: null, error: e instanceof Error ? e.message : "Could not read this game." };
    }
  }, [game]);

  const total = replay ? Math.max(0, replay.states.length - 1) : 0;

  // Start at the end of the game so the final position is the first thing you see.
  useEffect(() => {
    if (total > 0) setStep(total);
  }, [total]);

  const go = useCallback((n: number) => setStep(Math.max(0, Math.min(total, n))), [total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") go(step - 1);
      else if (e.key === "ArrowRight") go(step + 1);
      else if (e.key === "Home") go(0);
      else if (e.key === "End") go(total);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, step, total]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[data-current='true']");
    el?.scrollIntoView({ block: "nearest" });
  }, [step]);

  if (game === undefined) {
    return (
      <main className="shell">
        <p>Loading...</p>
      </main>
    );
  }
  if (game === null || !replay) {
    return (
      <main className="shell">
        <div className="topbar">
          <BackButton href="/games" label="Games" />
          <ThemeToggle />
        </div>
        <div className="card stack">
          <h2>Game not found</h2>
          <p>This game is not stored on this device any more.</p>
        </div>
      </main>
    );
  }
  if (replay.error) {
    return (
      <main className="shell">
        <div className="topbar">
          <BackButton href="/games" label="Games" />
          <ThemeToggle />
        </div>
        <div className="card stack">
          <h2>This game cannot be replayed</h2>
          <p>{replay.error}</p>
        </div>
      </main>
    );
  }

  const state = replay.states[step] as GameState;
  const final = replay.states[total] as GameState;
  const setupStones = replay.parsed ? replay.parsed.setup.black.length + replay.parsed.setup.white.length : 0;
  const rows: Array<{ n: number; a: number; b: number | null }> = [];
  for (let i = 0; i < total; i += 2) rows.push({ n: i / 2 + 1, a: i + 1, b: i + 1 < total ? i + 2 : null });
  const lastMove = step > 0 ? state.moves[step - 1] : undefined;

  const continueFromHere = () => {
    if (!window.confirm("Play on from this position with two players? A game already saved on this device will be replaced.")) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ sgf: toSGF(state), ai: null }));
    } catch {
      /* storage may be unavailable */
    }
    router.push("/play?resume=1");
  };

  const name = (c: 1 | 2) => (c === 1 ? game.black : game.white);

  return (
    <main className="shell">
      <div className="topbar">
        <div className="topbar-left">
          <BackButton href="/games" label="Games" />
          <span className="wordmark">
            <span className="dot" aria-hidden />
            PlayGoLite
          </span>
        </div>
        <ThemeToggle />
      </div>

      <div className="game-layout">
        <div className="game-main">
          <div className="statusbar">
            <div className="player">
              <span className="stone black" />
              {name(1)} <small>{state.captures.black} captured</small>
            </div>
            <div className="player">
              <span className="stone white" />
              {name(2)} <small>{state.captures.white} captured</small>
            </div>
          </div>
          <Board state={state} pending={null} koPoint={null} territory={null} showCoordinates={coords} onPoint={() => {}} />
        </div>

        <div className="game-side">
          <div className="panel">
            <div className="stack">
              <strong style={{ fontSize: "1.1rem" }}>{describeSgfResult(game.result)}</strong>
              <small style={{ color: "var(--muted)" }}>
                {game.size} x {game.size} &middot; komi {state.komi} &middot; {total} moves
              </small>
            </div>
            <div className="message" style={{ textAlign: "left" }} aria-live="polite">
              {step === 0
                ? "Start of the game"
                : `Move ${step}: ${lastMove?.color === 1 ? "Black" : "White"} ${label(state, step - 1)}${
                    lastMove && lastMove.captured > 0 ? `, captured ${lastMove.captured}` : ""
                  }`}
            </div>
            <div className="row">
              <button className="btn grow" onClick={() => go(0)} disabled={step === 0} aria-label="First move">
                |&lt;
              </button>
              <button className="btn grow" onClick={() => go(step - 1)} disabled={step === 0} aria-label="Previous move">
                &lt;
              </button>
              <button className="btn grow" onClick={() => go(step + 1)} disabled={step === total} aria-label="Next move">
                &gt;
              </button>
              <button className="btn grow" onClick={() => go(total)} disabled={step === total} aria-label="Last move">
                &gt;|
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={total}
              value={step}
              onChange={(e) => go(Number(e.target.value))}
              aria-label="Move number"
              style={{ width: "100%", accentColor: "var(--accent)" }}
            />
          </div>

          <div className="panel">
            <h2>Moves</h2>
            <div className="movelist" ref={listRef}>
              {rows.map((r) => (
                <div className="mv" key={r.n}>
                  <span>{r.n}</span>
                  <button
                    className={`mvbtn ${step === r.a ? "last" : ""}`}
                    data-current={step === r.a}
                    onClick={() => go(r.a)}
                  >
                    {label(final, r.a - 1)}
                  </button>
                  {r.b !== null ? (
                    <button
                      className={`mvbtn ${step === r.b ? "last" : ""}`}
                      data-current={step === r.b}
                      onClick={() => go(r.b as number)}
                    >
                      {label(final, r.b - 1)}
                    </button>
                  ) : (
                    <span />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="panel">
            <div className="row">
              <button className="btn grow" onClick={() => downloadText(sgfFilename(game.size, new Date(game.savedAt)), game.sgf)}>
                Download SGF
              </button>
              <button
                className="btn grow"
                onClick={async () => {
                  setCopied(await copyText(game.sgf));
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? "Copied" : "Copy SGF"}
              </button>
            </div>
            <button className="btn" onClick={continueFromHere} disabled={setupStones > 0 || step === total}>
              Play on from here
            </button>
            <div className="row">
              <label className="toggle">
                <input type="checkbox" checked={coords} onChange={(e) => setCoords(e.target.checked)} />
                Coordinates
              </label>
            </div>
            <button
              className="btn danger"
              onClick={() => {
                if (!window.confirm("Delete this game from this device?")) return;
                removeGame(game.id);
                router.push("/games");
              }}
            >
              Delete game
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
