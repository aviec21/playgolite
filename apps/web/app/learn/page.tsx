"use client";

import Link from "next/link";
import { LESSONS } from "@playgolite/learn";
import { BackButton } from "../../components/BackButton";
import { ThemeToggle } from "../../components/ThemeToggle";
import { LESSONS_KEY, useProgress } from "../../lib/progress";

export default function LearnPage() {
  const { done } = useProgress(LESSONS_KEY);
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
        <h1>Learn to play</h1>
        <p>
          Ten short lessons, each with something to do on a real board. {done.size} of {LESSONS.length} done.
        </p>
      </div>
      <div className="stack">
        {LESSONS.map((l, i) => (
          <Link key={l.id} href={`/learn/${l.id}`} className="card" style={{ display: "block" }}>
            <h2>
              {i + 1}. {l.title} {done.has(l.id) ? "(done)" : ""}
            </h2>
            <p>{l.summary}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
