"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { parseSGF, replaySGFStates } from "@playgolite/engine";
import { BackButton } from "../../components/BackButton";
import { ThemeToggle } from "../../components/ThemeToggle";
import { addGame, describeSgfResult, listGames, removeGame, type SavedGame } from "../../lib/gameStore";
import { downloadText, sgfFilename } from "../../lib/sgfFile";

const MAX_SGF_CHARS = 2_000_000;

export default function GamesPage() {
  const router = useRouter();
  const [games, setGames] = useState<SavedGame[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setGames(listGames()), []);

  const importText = (raw: string) => {
    setError(null);
    if (raw.length > MAX_SGF_CHARS) {
      setError("That file is too large to be a game record.");
      return;
    }
    try {
      const parsed = parseSGF(raw);
      const { states } = replaySGFStates(raw);
      if (states.length < 2) throw new Error("This SGF has no moves in it.");
      const last = states[states.length - 1]!;
      const re = parsed.info.result ?? "";
      const entry = addGame({
        sgf: raw.trim(),
        black: parsed.info.black ?? "Black",
        white: parsed.info.white ?? "White",
        result: re,
        size: parsed.size,
        moves: last.moves.length,
        source: "imported",
      });
      setText("");
      router.push(`/review?id=${entry.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This does not look like a valid SGF game.");
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SGF_CHARS) {
      setError("That file is too large to be a game record.");
      return;
    }
    importText(await file.text());
    if (fileRef.current) fileRef.current.value = "";
  };

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
        <h1>Games</h1>
        <p>Finished games are kept on this device. Open one to step through it, or import an SGF from another site.</p>
      </div>

      <div className="home-grid">
        <div className="home-col">
          <div className="card stack">
            <h2>Your games</h2>
            {games === null ? (
              <p>Loading...</p>
            ) : games.length === 0 ? (
              <p>No games yet. Finish a game and it appears here.</p>
            ) : (
              <div className="stack">
                {games.map((g) => (
                  <div key={g.id} className="gamerow">
                    <Link href={`/review?id=${g.id}`} className="gamelink">
                      <strong>
                        {g.black} vs {g.white}
                      </strong>
                      <small>
                        {g.size} x {g.size} &middot; {g.moves} moves &middot; {describeSgfResult(g.result)} &middot;{" "}
                        {new Date(g.savedAt).toLocaleDateString()}
                        {g.source === "imported" ? " (imported)" : ""}
                      </small>
                    </Link>
                    <button
                      className="btn"
                      aria-label={`Download ${g.black} vs ${g.white} as SGF`}
                      onClick={() => downloadText(sgfFilename(g.size, new Date(g.savedAt)), g.sgf)}
                    >
                      SGF
                    </button>
                    <button
                      className="btn danger"
                      aria-label={`Delete ${g.black} vs ${g.white}`}
                      onClick={() => {
                        if (!window.confirm("Delete this game from this device?")) return;
                        removeGame(g.id);
                        setGames(listGames());
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="home-col">
          <div className="card stack">
            <h2>Import an SGF</h2>
            <p>Choose a .sgf file, or paste the text of one below. Handicap stones are supported. Variations are ignored.</p>
            <input
              ref={fileRef}
              type="file"
              accept=".sgf,text/plain,application/x-go-sgf"
              onChange={(e) => void onFile(e.target.files?.[0])}
              style={{ font: "inherit", color: "var(--text)" }}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="(;GM[1]SZ[19];B[pd];W[dd]...)"
              rows={5}
              style={{
                font: "inherit",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.85rem",
                padding: 10,
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "var(--bg)",
                color: "var(--text)",
                resize: "vertical",
              }}
            />
            {error && <div className="message warn">{error}</div>}
            <button className="btn primary" disabled={text.trim() === ""} onClick={() => importText(text)}>
              Import and review
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
