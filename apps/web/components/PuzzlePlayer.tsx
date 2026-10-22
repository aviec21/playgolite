"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { play, type GameState } from "@playgolite/engine";
import {
  REASON_TEXT,
  bestDefense,
  goalStatus,
  playerMoveWins,
  puzzleStart,
  refutation,
  type Puzzle,
} from "@playgolite/learn";
import { BackButton } from "./BackButton";
import { Board } from "./Board";
import { ThemeToggle } from "./ThemeToggle";
import { PUZZLES_KEY, useProgress } from "../lib/progress";

type Phase = "playing" | "solved" | "failed";

export function PuzzlePlayer({ puzzle, nextId }: { puzzle: Puzzle; nextId: string | null }) {
  const start = useMemo(() => puzzleStart(puzzle), [puzzle]);
  const [state, setState] = useState<GameState>(start);
  const [movesLeft, setMovesLeft] = useState(puzzle.depth);
  const [phase, setPhase] = useState<Phase>("playing");
  const [message, setMessage] = useState<{ text: string; warn: boolean } | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const { markDone } = useProgress(PUZZLES_KEY);

  const [rx0, ry0, rx1, ry1] = puzzle.region;
  const crop = useMemo(
    () =>
      [
        Math.max(0, rx0 - 1),
        Math.max(0, ry0 - 1),
        Math.min(start.size - 1, rx1),
        Math.min(start.size - 1, ry1),
      ] as const,
    [rx0, ry0, rx1, ry1, start.size],
  );

  const reset = useCallback(() => {
    setState(start);
    setMovesLeft(puzzle.depth);
    setPhase("playing");
    setMessage(null);
    setBusy(false);
  }, [start, puzzle.depth]);

  const onPoint = (x: number, y: number) => {
    if (phase !== "playing" || busy) return;
    const r = play(state, { kind: "play", x, y });
    if (!r.ok) {
      setMessage({ text: REASON_TEXT[r.reason], warn: true });
      return;
    }
    const s1 = r.state;
    setBusy(true);
    // Let the stone render before the solver runs.
    setTimeout(() => {
      const won = playerMoveWins(puzzle, s1, movesLeft);
      if (!won) {
        const reply = refutation(puzzle, s1, movesLeft);
        let after = s1;
        if (reply) {
          const rr = play(s1, reply);
          if (rr.ok) after = rr.state;
        }
        setState(after);
        setPhase("failed");
        setMessage({ text: "Not quite. White found the answer to that.", warn: true });
        setBusy(false);
        return;
      }
      if (goalStatus(puzzle, s1) === "won" || puzzle.goal.type === "save") {
        setState(s1);
        setPhase("solved");
        setMessage(null);
        markDone(puzzle.id);
        setBusy(false);
        return;
      }
      const reply = bestDefense(puzzle, s1, movesLeft);
      let after = s1;
      if (reply) {
        const rr = play(s1, reply);
        if (rr.ok) after = rr.state;
      }
      setState(after);
      setMovesLeft(movesLeft - 1);
      setMessage({ text: "Good move. Keep going.", warn: false });
      setBusy(false);
    }, 30);
  };

  const goalText = puzzle.goal.type === "capture" ? "Capture the marked group." : "Save the marked stone.";
  const color = puzzle.toPlay === 1 ? "Black" : "White";
  const goalMark = [puzzle.goal.at] as const;

  return (
    <main className="shell">
      <div className="topbar">
        <div className="topbar-left">
          <BackButton href="/puzzles" label="Puzzles" />
          <Link href="/" className="wordmark">
            <span className="dot" aria-hidden />
            PlayGoLite
          </Link>
        </div>
        <ThemeToggle />
      </div>

      <div className="split">
      <div className="s-head stack">
        <small style={{ color: "var(--muted)" }}>
          {puzzle.category} &middot; level {puzzle.difficulty}
        </small>
        <h1>{puzzle.title}</h1>
        <p>
          {color} to play. {goalText}
          {puzzle.depth > 1 ? ` You have up to ${puzzle.depth} moves.` : ""}
        </p>
      </div>

      <div className="s-board">
      <Board
        state={state}
        pending={null}
        koPoint={null}
        territory={null}
        showCoordinates={false}
        onPoint={onPoint}
        crop={crop}
        marks={phase === "playing" ? goalMark : undefined}
      />
      </div>

      <div className="s-rest">

      <div className={`message ${message?.warn ? "warn" : ""}`} aria-live="polite">
        {phase === "solved" ? "Correct!" : (message?.text ?? (busy ? "Thinking..." : "Tap the board to play."))}
      </div>

      {showHint && phase !== "solved" && <p style={{ textAlign: "center" }}>Hint: {puzzle.hint}</p>}

      {phase === "playing" && (
        <div className="row">
          <button className="btn grow" onClick={() => setShowHint(true)} disabled={showHint}>
            Hint
          </button>
          <button className="btn grow" onClick={reset}>
            Restart
          </button>
        </div>
      )}

      {phase === "failed" && (
        <div className="row">
          <button className="btn primary grow" onClick={reset}>
            Try again
          </button>
          <button className="btn grow" onClick={() => setShowHint(true)} disabled={showHint}>
            Hint
          </button>
        </div>
      )}

      {phase === "solved" && (
        <div className="card stack">
          <h2>Solved</h2>
          <div className="row">
            {nextId ? (
              <Link href={`/puzzles/${nextId}`} className="btn primary grow" style={{ textAlign: "center" }}>
                Next puzzle
              </Link>
            ) : null}
            <Link href="/puzzles" className="btn grow" style={{ textAlign: "center" }}>
              All puzzles
            </Link>
          </div>
        </div>
      )}
      </div>
      </div>
    </main>
  );
}
