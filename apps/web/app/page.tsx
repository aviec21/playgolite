"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";

const SIZES = [
  { size: 9, note: "Quick, about 10 min" },
  { size: 13, note: "Medium" },
  { size: 19, note: "Full board" },
];

export default function Home() {
  const [size, setSize] = useState(9);
  const [hasSaved, setHasSaved] = useState(false);

  useEffect(() => {
    try {
      setHasSaved(localStorage.getItem("playgolite:local-game") !== null);
    } catch {
      setHasSaved(false);
    }
  }, []);

  return (
    <main className="shell">
      <div className="topbar">
        <span className="wordmark">
          <span className="dot" aria-hidden />
          PlayGoLite
        </span>
        <ThemeToggle />
      </div>

      <div className="stack" style={{ marginTop: 8 }}>
        <h1>The game of Go, kept simple.</h1>
        <p>Free, runs on any device, no sign-up needed to play.</p>
      </div>

      <div className="card stack">
        <h2>New game</h2>
        <p>Two players, one device. Pick a board size.</p>
        <div className="segments" role="group" aria-label="Board size">
          {SIZES.map((s) => (
            <button
              key={s.size}
              className="segment"
              aria-pressed={size === s.size}
              onClick={() => setSize(s.size)}
            >
              {s.size} x {s.size}
              <small>{s.note}</small>
            </button>
          ))}
        </div>
        <Link href={`/play?size=${size}`} className="btn primary" style={{ textAlign: "center" }}>
          Start game
        </Link>
        {hasSaved && (
          <Link href="/play?resume=1" className="btn" style={{ textAlign: "center" }}>
            Continue saved game
          </Link>
        )}
      </div>

      <div className="card stack">
        <h2>Coming next</h2>
        <p>Learn to play, puzzles, play against the computer, and online games with a link.</p>
      </div>
    </main>
  );
}
