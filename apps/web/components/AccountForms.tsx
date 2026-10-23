"use client";

import { useState } from "react";
import { ApiError, api } from "../lib/onlineClient";
import { downloadText } from "../lib/sgfFile";
import { copyText } from "../lib/sgfFile";
import type { AccountUser } from "../lib/onlineShared";

type Mode = "signin" | "register" | "recover";

export function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <div className="card stack">
      <h2>Save your recovery codes</h2>
      <p>
        There is no email on this account, so these codes are the only way back in if you forget your password. Each works once. They
        are shown now and never again.
      </p>
      <div className="codes">
        {codes.map((c) => (
          <span key={c}>{c}</span>
        ))}
      </div>
      <div className="row">
        <button
          className="btn grow"
          onClick={async () => {
            setCopied(await copyText(codes.join("\n")));
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button className="btn grow" onClick={() => downloadText("playgolite-recovery-codes.txt", codes.join("\n") + "\n")}>
          Download
        </button>
      </div>
      <label className="row" style={{ alignItems: "center" }}>
        <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
        <span>I have saved these somewhere safe</span>
      </label>
      <button className="btn primary" disabled={!saved} onClick={onDone}>
        Continue
      </button>
    </div>
  );
}

export function SignInForm({ onUser }: { onUser: (u: AccountUser, codes?: string[]) => void }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        const r = await api<{ user: AccountUser; recoveryCodes: string[] }>("/api/auth/register", "POST", { username, password });
        onUser(r.user, r.recoveryCodes);
      } else if (mode === "recover") {
        const r = await api<{ user: AccountUser }>("/api/auth/recover", "POST", { username, code, password });
        onUser(r.user);
      } else {
        const r = await api<{ user: AccountUser }>("/api/auth/login", "POST", { username, password });
        onUser(r.user);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <div className="tabs" role="tablist">
        {(
          [
            ["signin", "Sign in"],
            ["register", "Create account"],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" className="btn grow" aria-pressed={mode === m} onClick={() => { setMode(m); setError(null); }}>
            {label}
          </button>
        ))}
      </div>
      {mode === "recover" && <p>Enter your username, one unused recovery code, and a new password.</p>}
      <label className="field">
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required />
      </label>
      {mode === "recover" && (
        <label className="field">
          Recovery code
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="xxxxx-xxxxx" autoCapitalize="none" spellCheck={false} required />
        </label>
      )}
      <label className="field">
        {mode === "recover" ? "New password" : "Password"}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={mode === "signin" ? undefined : 8}
          required
        />
      </label>
      {mode === "register" && <small style={{ color: "var(--muted)" }}>3 to 20 letters, numbers or underscores. Password at least 8 characters.</small>}
      {error && <div className="message warn" role="alert">{error}</div>}
      <button className="btn primary" disabled={busy}>
        {busy ? "Please wait..." : mode === "register" ? "Create account" : mode === "recover" ? "Reset password" : "Sign in"}
      </button>
      {mode !== "recover" ? (
        <button type="button" className="btn" onClick={() => { setMode("recover"); setError(null); }}>
          Forgot password?
        </button>
      ) : (
        <button type="button" className="btn" onClick={() => { setMode("signin"); setError(null); }}>
          Back to sign in
        </button>
      )}
    </form>
  );
}
