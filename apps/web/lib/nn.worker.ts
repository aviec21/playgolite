import * as ort from "onnxruntime-web/wasm";
import { deadGroupsFromOwnership, featuresFromState, pickNetMove, POS_LEN } from "@playgolite/ai";
import type { GameState, Move } from "@playgolite/engine";
import { MODEL_CACHE, MODEL_URL, ORT_BASE } from "./nnConfig";

type Req =
  | { id: number; kind: "init" }
  | { id: number; kind: "move"; state: GameState; temperature: number }
  | { id: number; kind: "dead"; state: GameState };

let session: ort.InferenceSession | null = null;
let loading: Promise<ort.InferenceSession> | null = null;

async function loadSession(): Promise<ort.InferenceSession> {
  if (session) return session;
  if (!loading) {
    loading = (async () => {
      ort.env.wasm.wasmPaths = ORT_BASE;
      const threads = (self as unknown as { crossOriginIsolated?: boolean }).crossOriginIsolated
        ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency ?? 2) - 1))
        : 1;
      ort.env.wasm.numThreads = threads;
      const cache = await caches.open(MODEL_CACHE);
      let resp = await cache.match(MODEL_URL);
      if (!resp) {
        const net = await fetch(MODEL_URL);
        if (!net.ok) throw new Error(`model download failed: ${net.status}`);
        await cache.put(MODEL_URL, net.clone());
        resp = net;
      }
      const bytes = new Uint8Array(await resp.arrayBuffer());
      const s = await ort.InferenceSession.create(bytes, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      session = s;
      return s;
    })();
    loading.catch(() => {
      loading = null;
    });
  }
  return loading;
}

async function evaluate(state: GameState) {
  const s = await loadSession();
  const f = featuresFromState(state);
  const out = await s.run({
    spatial: new ort.Tensor("float32", f.spatial, [1, 22, POS_LEN, POS_LEN]),
    global: new ort.Tensor("float32", f.global, [1, 19]),
  });
  return {
    policy: out.policy!.data as Float32Array,
    value: out.value!.data as Float32Array,
    ownership: out.ownership!.data as Float32Array,
  };
}

self.onmessage = async (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    if (req.kind === "init") {
      await loadSession();
      self.postMessage({ id: req.id, ok: true, result: true });
    } else if (req.kind === "move") {
      const out = await evaluate(req.state);
      const move: Move = pickNetMove(req.state, out, { temperature: req.temperature });
      self.postMessage({ id: req.id, ok: true, result: move });
    } else {
      const out = await evaluate(req.state);
      self.postMessage({ id: req.id, ok: true, result: deadGroupsFromOwnership(req.state, out.ownership) });
    }
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: String(err) });
  }
};
