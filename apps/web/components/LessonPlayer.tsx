"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GameState } from "@playgolite/engine";
import {
  countAnswer,
  countOptions,
  evaluateLessonMove,
  lessonStepState,
  type Lesson,
} from "@playgolite/learn";
import { BackButton } from "./BackButton";
import { Board } from "./Board";
import { ThemeToggle } from "./ThemeToggle";
import { LESSONS_KEY, useProgress } from "../lib/progress";

export function LessonPlayer({ lesson, nextId }: { lesson: Lesson; nextId: string | null }) {
  const [index, setIndex] = useState(0);
  const step = lesson.steps[index]!;
  const start = useMemo(() => lessonStepState(step), [step]);
  const [state, setState] = useState<GameState | null>(start);
  const [solved, setSolved] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { markDone } = useProgress(LESSONS_KEY);

  // Reset when moving to another step.
  useEffect(() => {
    setState(start);
    setMessage(null);
    setSolved(step.task.type === "info");
  }, [start, step]);

  const last = index === lesson.steps.length - 1;
  const task = step.task;
  const isMoveTask = ["play-any", "play-at", "capture", "atari", "illegal"].includes(task.type);

  const onPoint = (x: number, y: number) => {
    if (!state || solved || !isMoveTask) return;
    const r = evaluateLessonMove(step, state, x, y);
    if (r.kind === "success") {
      setState(r.state);
      setSolved(true);
      setMessage(null);
    } else {
      setMessage(r.message);
    }
  };

  const pick = (correct: boolean) => {
    if (correct) {
      setSolved(true);
      setMessage(null);
    } else {
      setMessage("Not quite. Have another look.");
    }
  };

  const next = () => {
    if (last) {
      markDone(lesson.id);
      return;
    }
    setIndex(index + 1);
  };

  let options: Array<{ label: string; correct: boolean }> | null = null;
  let question: string | null = null;
  if (task.type === "choice") {
    question = task.question;
    options = task.options.map((label, i) => ({ label, correct: i === task.answer }));
  } else if (task.type === "count" && state) {
    question = task.question;
    const answer = countAnswer(state, task.measure);
    options = countOptions(answer).map((n) => ({ label: String(n), correct: n === answer }));
  }

  const finished = last && solved;

  return (
    <main className="shell">
      <div className="topbar">
        <div className="topbar-left">
          <BackButton
            href="/learn"
            label="Lessons"
            warn={index > 0 && !finished ? "Leave this lesson? Your place in it is not saved until you finish." : null}
          />
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
          {lesson.title} &middot; step {index + 1} of {lesson.steps.length}
        </small>
        <h1>{step.title ?? lesson.title}</h1>
        <p>{step.text}</p>
      </div>

      <div className="s-board">
      {state && step.board && (
        <Board
          state={state}
          pending={null}
          koPoint={null}
          territory={null}
          showCoordinates={false}
          onPoint={onPoint}
          {...(step.board.crop ? { crop: step.board.crop } : {})}
          {...(step.board.marks && !solved ? { marks: step.board.marks } : {})}
        />
      )}
      </div>

      <div className="s-rest">

      {options && question && !solved && (
        <div className="card stack">
          <h2>{question}</h2>
          <div className="stack">
            {options.map((o) => (
              <button key={o.label} className="btn" onClick={() => pick(o.correct)}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`message ${message ? "warn" : ""}`} aria-live="polite">
        {solved ? step.success : (message ?? (isMoveTask ? "Tap the board to try it." : ""))}
      </div>

      {finished ? (
        <div className="card stack">
          <h2>Lesson complete</h2>
          <div className="row">
            {nextId ? (
              <Link href={`/learn/${nextId}`} className="btn primary grow" style={{ textAlign: "center" }} onClick={() => markDone(lesson.id)}>
                Next lesson
              </Link>
            ) : (
              <Link href="/puzzles" className="btn primary grow" style={{ textAlign: "center" }} onClick={() => markDone(lesson.id)}>
                Try the puzzles
              </Link>
            )}
            <Link href="/learn" className="btn grow" style={{ textAlign: "center" }} onClick={() => markDone(lesson.id)}>
              All lessons
            </Link>
          </div>
        </div>
      ) : (
        <div className="row">
          <button className="btn primary grow" disabled={!solved} onClick={next}>
            {last ? "Finish" : "Next"}
          </button>
        </div>
      )}
      </div>
      </div>
    </main>
  );
}
