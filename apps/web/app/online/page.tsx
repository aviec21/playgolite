"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { BackButton } from "../../components/BackButton";
import { ThemeToggle } from "../../components/ThemeToggle";
import { ApiError, api, useMe } from "../../lib/onlineClient";
import { ONLINE_SIZES, TIME_PRESETS, describeTime, type OnlineGame } from "../../lib/onlineShared";

function describeResult(re: string | null): string {
  if (!re) return "";
  if (re === "0") return "Draw";
  const m = /^([BW])\+(.*)$/.exec(re);
  if (!m) return re;
  const who = m[1] === "B" ? "Black" : "White";
  return m[2] === "R" ? `${who} won by resignation` : m[2] === "T" ? `${who} won on time` : `${who} won by ${m[2]}`;
}

export default function OnlinePage() {
  const router = useRouter();
  const { user } = useMe();
  const [mine, setMine] = useState<OnlineGame[] | null>(null);
  const [open, setOpen] = useState<OnlineGame[]>([]);
  const [size, setSize] = useState<number>(9);
  const [color, setColor] = useState<"black" | "white" | "random">("random");
  const [time, setTime] = useState("live-10-5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        api<{ games: OnlineGame[] }>("/api/games?scope=mine"),
        api<{ games: OnlineGame[] }>("/api/games?scope=open"),
      ]);
      setMine(a.games);
      setOpen(b.games);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load games.");
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void load();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 10_000);
    return () => clearInterval(t);
  }, [user, load]);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ game: OnlineGame }>("/api/games", "POST", { size, color, time });
      router.push(`/g/${r.game.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create the game.");
      setBusy(false);
    }
  };

  const yourTurn = (g: OnlineGame) => g.status === "playing" && g.you === g.toPlay;
  const active = (mine ?? []).filter((g) => g.status !== "finished");
  const finished = (mine ?? []).filter((g) => g.status === "finished");

  const row = (g: OnlineGame) => {
    const opp = g.you === "black" ? g.white : g.you === "white" ? g.black : null;
    const title = g.status === "open" ? "Waiting for an opponent" : `vs ${opp?.username ?? "?"}`;
    return (
      <div key={g.id} className="gamerow">
        <Link href={`/g/${g.id}`} className="gamelink">
          <strong>
            {title}
            {yourTurn(g) ? " - your turn" : g.status === "scoring" ? " - scoring" : ""}
          </strong>
          <small>
            {g.size} x {g.size} &middot; {describeTime(g.tc)}
            {g.status === "finished" ? ` · ${describeResult(g.result)}` : ""}
          </small>
        </Link>
      </div>
    );
  };

  return (
    <main className="shell">
      <div className="topbar">
        <div className="topbar-left">
          <BackButton href="/" label="Home" />
          <Link href="/" className="wordmark hide-narrow">
            <span className="dot" aria-hidden />
            PlayGoLite
          </Link>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "nowrap" }}>
          <Link href="/account" className="btn" style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user ? user.username : "Account"}
          </Link>
          <ThemeToggle />
        </div>
      </div>

      <div className="stack">
        <h1>Play online</h1>
        <p>Start a game and send the link to a friend, or join one from the list.</p>
      </div>

      {user === undefined ? (
        <p>Loading...</p>
      ) : user === null ? (
        <div className="card stack" style={{ maxWidth: 460 }}>
          <h2>Sign in to play online</h2>
          <p>You need a free account so your games and moves are saved.</p>
          <Link href="/account?next=/online" className="btn primary" style={{ textAlign: "center" }}>
            Sign in or create an account
          </Link>
        </div>
      ) : (
        <div className="home-grid">
          <div className="home-col">
            <div className="card stack">
              <h2>New game</h2>
              <div className="segments" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {ONLINE_SIZES.map((s) => (
                  <button key={s} className="segment" aria-pressed={size === s} onClick={() => setSize(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="segments">
                {(
                  [
                    ["black", "Black"],
                    ["white", "White"],
                    ["random", "Random"],
                  ] as const
                ).map(([c, label]) => (
                  <button key={c} className="segment" aria-pressed={color === c} onClick={() => setColor(c)}>
                    {label}
                  </button>
                ))}
              </div>
              <label className="field">
                Time
                <select value={time} onChange={(e) => setTime(e.target.value)}>
                  <optgroup label="Live">
                    {TIME_PRESETS.filter((p) => p.kind === "live").map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Daily (take your time)">
                    {TIME_PRESETS.filter((p) => p.kind === "daily").map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </label>
              {error && <div className="message warn" role="alert">{error}</div>}
              <button className="btn primary" onClick={create} disabled={busy}>
                {busy ? "Creating..." : "Create game"}
              </button>
            </div>

            <div className="card stack">
              <h2>Open games</h2>
              {open.length === 0 ? (
                <p>Nobody is waiting right now.</p>
              ) : (
                open.map((g) => (
                  <div key={g.id} className="gamerow">
                    <Link href={`/g/${g.id}`} className="gamelink">
                      <strong>{g.creator.username}</strong>
                      <small>
                        {g.size} x {g.size} &middot; {describeTime(g.tc)}
                      </small>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="home-col">
            <div className="card stack">
              <h2>Your games</h2>
              {mine === null ? <p>Loading...</p> : active.length === 0 ? <p>No games running.</p> : active.map(row)}
            </div>
            {finished.length > 0 && (
              <div className="card stack">
                <h2>Finished</h2>
                {finished.slice(0, 10).map(row)}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
