import { createGame, play } from "./game";
import type { GameState, Move } from "./types";

const LETTERS = "abcdefghijklmnopqrs";

function coord(x: number, y: number): string {
  return `${LETTERS[x]}${LETTERS[y]}`;
}

/** Serialize the move list of a game as SGF (FF[4], Chinese rules). */
export function toSGF(
  state: Pick<GameState, "size" | "komi" | "moves" | "result">,
  info: { black?: string; white?: string; date?: string } = {},
): string {
  const head = [
    "GM[1]",
    "FF[4]",
    "CA[UTF-8]",
    "AP[PlayGoLite]",
    "RU[Chinese]",
    `SZ[${state.size}]`,
    `KM[${state.komi}]`,
  ];
  if (info.black) head.push(`PB[${info.black}]`);
  if (info.white) head.push(`PW[${info.white}]`);
  if (info.date) head.push(`DT[${info.date}]`);
  const r = state.result;
  if (r) {
    if (r.winner === null) head.push("RE[0]");
    else if (r.reason === "resign") head.push(`RE[${r.winner === 1 ? "B" : "W"}+R]`);
    else if (r.reason === "timeout") head.push(`RE[${r.winner === 1 ? "B" : "W"}+T]`);
    else head.push(`RE[${r.winner === 1 ? "B" : "W"}+${r.margin}]`);
  }
  const body = state.moves
    .filter((m) => m.move.kind !== "resign")
    .map((m) => {
      const c = m.color === 1 ? "B" : "W";
      return m.move.kind === "play" ? `;${c}[${coord(m.move.x, m.move.y)}]` : `;${c}[]`;
    })
    .join("");
  return `(;${head.join("")}${body})`;
}

export interface ParsedSGF {
  size: number;
  komi: number | undefined;
  moves: Array<{ color: 1 | 2; move: Move }>;
}

/** Parse the main line of a simple SGF (no variations, no setup stones). */
export function parseSGF(text: string): ParsedSGF {
  const size = Number(/SZ\[(\d+)\]/.exec(text)?.[1] ?? 19);
  const komiRaw = /KM\[(-?[\d.]+)\]/.exec(text)?.[1];
  const moves: ParsedSGF["moves"] = [];
  const re = /;\s*([BW])\[([a-z]{0,2})\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const color = m[1] === "B" ? 1 : 2;
    const pos = m[2] ?? "";
    // "tt" is the legacy pass marker on boards up to 19x19.
    if (pos === "" || (pos === "tt" && size <= 19)) {
      moves.push({ color, move: { kind: "pass" } });
    } else {
      moves.push({
        color,
        move: { kind: "play", x: LETTERS.indexOf(pos[0] as string), y: LETTERS.indexOf(pos[1] as string) },
      });
    }
  }
  return { size, komi: komiRaw === undefined ? undefined : Number(komiRaw), moves };
}

/** Replay an SGF through the rules engine. Throws if a move is illegal. */
export function replaySGF(text: string): GameState {
  const parsed = parseSGF(text);
  let state = createGame({
    size: parsed.size,
    ...(parsed.komi !== undefined ? { komi: parsed.komi } : {}),
  });
  parsed.moves.forEach((entry, i) => {
    // SGF can start with white or have passes out of turn; keep the engine in sync.
    if (state.toPlay !== entry.color) state = { ...state, toPlay: entry.color };
    const r = play(state, entry.move);
    if (!r.ok) throw new Error(`SGF move ${i + 1} is illegal: ${r.reason}`);
    state = r.state;
  });
  return state;
}
