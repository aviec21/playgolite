"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BackButton } from "../../components/BackButton";
import { RecoveryCodes, SignInForm } from "../../components/AccountForms";
import { ThemeToggle } from "../../components/ThemeToggle";
import { ApiError, api, useMe } from "../../lib/onlineClient";

function safeNext(): string {
  try {
    const n = new URLSearchParams(window.location.search).get("next") ?? "";
    return n.startsWith("/") && !n.startsWith("//") ? n : "/online";
  } catch {
    return "/online";
  }
}

export default function AccountPage() {
  const { user, codesLeft, problem, refresh, setUser } = useMe();
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [next, setNext] = useState("/online");
  useEffect(() => setNext(safeNext()), []);

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [codesPw, setCodesPw] = useState("");
  const [note, setNote] = useState<{ text: string; warn: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (e) {
      setNote({ text: e instanceof ApiError ? e.message : "Something went wrong.", warn: true });
    } finally {
      setBusy(false);
    }
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
        <h1>Account</h1>
        <p>An account lets you play other people online. Playing the computer, lessons and puzzles never need one.</p>
      </div>

      {problem && <div className="banner">{problem}</div>}

      {newCodes ? (
        <RecoveryCodes
          codes={newCodes}
          onDone={() => {
            setNewCodes(null);
            if (window.location.search.includes("next=")) window.location.href = next;
            else void refresh();
          }}
        />
      ) : user === undefined ? (
        <p>Loading...</p>
      ) : user === null ? (
        <div style={{ maxWidth: 460 }}>
          <SignInForm
            onUser={(u, codes) => {
              setUser(u);
              if (codes) setNewCodes(codes);
              else if (window.location.search.includes("next=")) window.location.href = next;
              else void refresh();
            }}
          />
        </div>
      ) : (
        <div className="home-grid">
          <div className="home-col">
            <div className="card stack">
              <h2>{user.username}</h2>
              <p>
                Rating {user.rating}
                {user.ratedGames < 10 ? " (provisional)" : ""} &middot; recovery codes left: {codesLeft ?? "?"}
              </p>
              {codesLeft !== null && codesLeft <= 2 && (
                <div className="banner">You are running low on recovery codes. Make a new set below.</div>
              )}
              <div className="row">
                <Link href="/online" className="btn primary grow" style={{ textAlign: "center" }}>
                  Play online
                </Link>
                <button
                  className="btn grow"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      await api("/api/auth/logout", "POST", {});
                      setUser(null);
                    })
                  }
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>

          <div className="home-col">
            <form
              className="card stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("/api/auth/password", "POST", { current: pwCurrent, next: pwNew });
                  setPwCurrent("");
                  setPwNew("");
                  setNote({ text: "Password changed.", warn: false });
                });
              }}
            >
              <h2>Change password</h2>
              <label className="field">
                Current password
                <input type="password" value={pwCurrent} onChange={(e) => setPwCurrent(e.target.value)} autoComplete="current-password" required />
              </label>
              <label className="field">
                New password
                <input type="password" value={pwNew} onChange={(e) => setPwNew(e.target.value)} autoComplete="new-password" minLength={8} required />
              </label>
              <button className="btn" disabled={busy}>
                Change password
              </button>
            </form>

            <form
              className="card stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  const r = await api<{ recoveryCodes: string[] }>("/api/auth/codes", "POST", { password: codesPw });
                  setCodesPw("");
                  setNewCodes(r.recoveryCodes);
                });
              }}
            >
              <h2>New recovery codes</h2>
              <p>This replaces all your old codes with 8 new ones.</p>
              <label className="field">
                Password
                <input type="password" value={codesPw} onChange={(e) => setCodesPw(e.target.value)} autoComplete="current-password" required />
              </label>
              <button className="btn" disabled={busy}>
                Make new codes
              </button>
            </form>
            {note && <div className={`message ${note.warn ? "warn" : ""}`} role="status">{note.text}</div>}
          </div>
        </div>
      )}
    </main>
  );
}
