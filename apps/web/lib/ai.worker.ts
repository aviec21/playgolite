import { chooseMove, estimateDeadGroups, type Level } from "@playgolite/ai";
import type { GameState } from "@playgolite/engine";

type Req =
  | { id: number; kind: "move"; state: GameState; level: Level }
  | { id: number; kind: "dead"; state: GameState };

self.onmessage = (e: MessageEvent<Req>) => {
  const req = e.data;
  try {
    if (req.kind === "move") {
      self.postMessage({ id: req.id, ok: true, result: chooseMove(req.state, req.level) });
    } else {
      self.postMessage({ id: req.id, ok: true, result: estimateDeadGroups(req.state, 300) });
    }
  } catch (err) {
    self.postMessage({ id: req.id, ok: false, error: String(err) });
  }
};
