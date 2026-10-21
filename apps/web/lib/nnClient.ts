"use client";

import { useCallback, useEffect, useState } from "react";
import type { GameState, Move } from "@playgolite/engine";
import { MODEL_CACHE, MODEL_URL } from "./nnConfig";

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL("./nn.worker.ts", import.meta.url));
  w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if (e.data.ok) p.resolve(e.data.result);
    else p.reject(new Error(e.data.error ?? "network error"));
  };
  w.onerror = () => {
    worker = null;
    for (const p of pending.values()) p.reject(new Error("worker failed"));
    pending.clear();
  };
  worker = w;
  return w;
}

function call<T>(msg: Record<string, unknown>): Promise<T> {
  const w = getWorker();
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, ...msg });
  });
}

/** Is the network already stored on this device? */
export async function isNetworkInstalled(): Promise<boolean> {
  try {
    if (typeof caches === "undefined") return false;
    return (await caches.has(MODEL_CACHE)) && !!(await (await caches.open(MODEL_CACHE)).match(MODEL_URL));
  } catch {
    return false;
  }
}

/** Download the network into the browser's cache, reporting progress from 0 to 1. */
export async function installNetwork(onProgress: (fraction: number) => void): Promise<void> {
  const resp = await fetch(MODEL_URL);
  if (!resp.ok || !resp.body) throw new Error(`download failed (${resp.status})`);
  const total = Number(resp.headers.get("content-length") ?? 0);
  const reader = resp.body.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    if (total > 0) onProgress(Math.min(1, got / total));
  }
  const cache = await caches.open(MODEL_CACHE);
  await cache.put(MODEL_URL, new Response(new Blob(chunks as BlobPart[]), { headers: { "content-type": "application/octet-stream" } }));
  onProgress(1);
}

export async function removeNetwork(): Promise<void> {
  try {
    await caches.delete(MODEL_CACHE);
  } catch {
    /* nothing to remove */
  }
}

export function networkMove(state: GameState, temperature = 0): Promise<Move> {
  return call<Move>({ kind: "move", state, temperature });
}

export function networkDeadGroups(state: GameState): Promise<number[]> {
  return call<number[]>({ kind: "dead", state });
}

export type NetworkStatus = "checking" | "missing" | "installing" | "installed" | "error";

/** State and actions for the install button. */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>("checking");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let alive = true;
    isNetworkInstalled().then((ok) => {
      if (alive) setStatus(ok ? "installed" : "missing");
    });
    return () => {
      alive = false;
    };
  }, []);

  const install = useCallback(async () => {
    setStatus("installing");
    setProgress(0);
    try {
      await installNetwork(setProgress);
      setStatus("installed");
    } catch {
      setStatus("error");
    }
  }, []);

  const remove = useCallback(async () => {
    await removeNetwork();
    setStatus("missing");
  }, []);

  return { status, progress, install, remove };
}
