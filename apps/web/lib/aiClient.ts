import type { Choice, Level } from "@playgolite/ai";
import type { GameState } from "@playgolite/engine";

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (workerFailed || typeof Worker === "undefined") return null;
  if (worker) return worker;
  try {
    const w = new Worker(new URL("./ai.worker.ts", import.meta.url));
    w.onmessage = (e: MessageEvent<{ id: number; ok: boolean; result?: unknown; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error ?? "AI error"));
    };
    w.onerror = () => {
      workerFailed = true;
      worker = null;
      for (const p of pending.values()) p.reject(new Error("worker failed"));
      pending.clear();
    };
    worker = w;
    return w;
  } catch {
    workerFailed = true;
    return null;
  }
}

function call<T>(msg: Record<string, unknown>): Promise<T> {
  const w = getWorker();
  if (!w) return Promise.reject(new Error("no worker"));
  const id = nextId++;
  return new Promise<T>((resolve, reject) => {
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject });
    w.postMessage({ id, ...msg });
  });
}

export async function computeMove(state: GameState, level: Level): Promise<Choice> {
  try {
    return await call<Choice>({ kind: "move", state, level });
  } catch {
    const ai = await import("@playgolite/ai");
    return ai.chooseMove(state, level);
  }
}

export async function computeDead(state: GameState): Promise<number[]> {
  try {
    return await call<number[]>({ kind: "dead", state });
  } catch {
    const ai = await import("@playgolite/ai");
    return ai.estimateDeadGroups(state, 300);
  }
}
