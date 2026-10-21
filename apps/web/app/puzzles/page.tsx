"use client";

import Link from "next/link";
import { PUZZLES, PUZZLE_CATEGORIES } from "@playgolite/learn";
import { BackButton } from "../../components/BackButton";
import { ThemeToggle } from "../../components/ThemeToggle";
import { PUZZLES_KEY, useProgress } from "../../lib/progress";

export default function PuzzlesPage() {
  const { done } = useProgress(PUZZLES_KEY);
  return (
    <main className="shell">
      <div className="topbar">
        <div className="topbar-left">
          <BackButton href="/" label="Home" />
          <Link href="/" className="wordmark">
            <span className="dot" aria-hidden />
            PlayGoLite
          </Link>
        </div>
        <ThemeToggle />
      </div>
      <div className="stack">
        <h1>Puzzles</h1>
        <p>
          Find the move. Every answer is checked by the game engine. {done.size} of {PUZZLES.length} solved.
        </p>
      </div>
      {PUZZLE_CATEGORIES.map((cat) => {
        const list = PUZZLES.filter((p) => p.category === cat);
        if (list.length === 0) return null;
        return (
          <div key={cat} className="card stack">
            <h2>{cat}</h2>
            <div className="row">
              {list.map((p) => (
                <Link
                  key={p.id}
                  href={`/puzzles/${p.id}`}
                  className="btn"
                  title={p.title}
                  style={done.has(p.id) ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
                >
                  {p.id.replace(/^[a-z]+-/, "").replace("-w", "w")}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </main>
  );
}
