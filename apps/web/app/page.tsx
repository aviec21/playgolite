"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../components/ThemeToggle";
import { useNetworkStatus } from "../lib/nnClient";
import { MODEL_SIZE_LABEL } from "../lib/nnConfig";

const LEVELS = [
  { id: "beginner", label: "Beginner", blurb: "Plays mostly at random." },
  { id: "easy", label: "Easy", blurb: "Sees captures and ataris." },
  { id: "medium", label: "Medium", blurb: "Looks a little ahead." },
  { id: "hard", label: "Hard", blurb: "Thinks for a few seconds." },
  { id: "expert", label: "Expert", blurb: "Uses all the time it can. Slower on 19 x 19." },
  { id: "master", label: "Master", blurb: "A neural network trained by KataGo. Much stronger than Expert." },
];

const SIZES = [
  { size: 9, note: "Quick, about 10 min" },
  { size: 13, note: "Medium" },
  { size: 19, note: "Full board" },
];

export default function Home() {
  const [size, setSize] = useState(9);
  const [opponent, setOpponent] = useState<"ai" | "pvp">("ai");
  const [level, setLevel] = useState("easy");
  const [color, setColor] = useState("black");
  const net = useNetworkStatus();
  const needsNetwork = opponent === "ai" && level === "master" && net.status !== "installed";
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
        <div className="segments" role="group" aria-label="Opponent">
          <button className="segment" aria-pressed={opponent === "ai"} onClick={() => setOpponent("ai")}>
            Computer
          </button>
          <button className="segment" aria-pressed={opponent === "pvp"} onClick={() => setOpponent("pvp")}>
            Two players
          </button>
        </div>
        {opponent === "ai" && (
          <>
            <div className="segments" role="group" aria-label="Level">
              {LEVELS.map((l) => (
                <button key={l.id} className="segment" aria-pressed={level === l.id} onClick={() => setLevel(l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
            <p>{LEVELS.find((l) => l.id === level)?.blurb}</p>
            <div className="segments" role="group" aria-label="Your colour">
              {["black", "white", "random"].map((c) => (
                <button key={c} className="segment" aria-pressed={color === c} onClick={() => setColor(c)}>
                  {c[0]?.toUpperCase() + c.slice(1)}
                </button>
              ))}
            </div>
          </>
        )}
        <p>Pick a board size.</p>
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
        {opponent === "ai" && level === "master" && (
          <div className="stack">
            {net.status === "installed" ? (
              <small style={{ color: "var(--muted)" }}>
                Master is installed on this device and works offline.{" "}
                <button className="linklike" onClick={() => void net.remove()}>
                  Remove it
                </button>
              </small>
            ) : net.status === "installing" ? (
              <div>
                <div className="progress" aria-label="Download progress">
                  <div style={{ width: `${Math.round(net.progress * 100)}%` }} />
                </div>
                <small style={{ color: "var(--muted)" }}>Downloading... {Math.round(net.progress * 100)}%</small>
              </div>
            ) : (
              <>
                <small style={{ color: "var(--muted)" }}>
                  Master needs a one-time download ({MODEL_SIZE_LABEL}). It is kept on this device and works offline.
                  Use Wi-Fi if you can.
                </small>
                {net.status === "error" && (
                  <small style={{ color: "var(--danger)" }}>The download failed. Check your connection and try again.</small>
                )}
                <button className="btn primary" disabled={net.status === "checking"} onClick={() => void net.install()}>
                  {net.status === "error" ? "Try again" : `Download Master (${MODEL_SIZE_LABEL})`}
                </button>
              </>
            )}
          </div>
        )}
        <Link
          aria-disabled={needsNetwork}
          tabIndex={needsNetwork ? -1 : undefined}
          onClick={(e) => needsNetwork && e.preventDefault()}
          style={needsNetwork ? { opacity: 0.45, pointerEvents: "none", textAlign: "center" } : { textAlign: "center" }}
          href={opponent === "ai" ? `/play?size=${size}&vs=ai&level=${level}&color=${color}` : `/play?size=${size}`} className="btn primary">
          Start game
        </Link>
        {hasSaved && (
          <Link href="/play?resume=1" className="btn" style={{ textAlign: "center" }}>
            Continue saved game
          </Link>
        )}
      </div>

      <div className="row">
        <Link href="/learn" className="card grow" style={{ flex: 1 }}>
          <h2>Learn to play</h2>
          <p>Ten short interactive lessons.</p>
        </Link>
        <Link href="/puzzles" className="card grow" style={{ flex: 1 }}>
          <h2>Puzzles</h2>
          <p>Capture, escape and connect.</p>
        </Link>
      </div>

      <div className="card stack">
        <h2>Coming next</h2>
        <p>Online games with a link, accounts and rankings.</p>
      </div>
    </main>
  );
}
