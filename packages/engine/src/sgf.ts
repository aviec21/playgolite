import { createFromBoard, createGame, play } from "./game";
import type { Cell, GameState, Move } from "./types";

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

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

export interface SGFInfo {
  black?: string;
  white?: string;
  result?: string;
  date?: string;
}

export interface ParsedSGF {
  size: number;
  komi: number | undefined;
  moves: Array<{ color: 1 | 2; move: Move }>;
  /** Handicap or setup stones from the root node (AB / AW). */
  setup: { black: Array<[number, number]>; white: Array<[number, number]> };
  /** Colour to play first, from PL, when given. */
  toPlay: 1 | 2 | undefined;
  info: SGFInfo;
}

type SgfNode = Record<string, string[]>;

/** Read the main line (always the first branch) of an SGF game tree. Variations are skipped. */
function mainLine(text: string): SgfNode[] {
  let i = text.indexOf("(");
  if (i < 0) i = 0;
  const n = text.length;

  const skipSpace = () => {
    while (i < n && /\s/.test(text[i] as string)) i++;
  };

  const readNode = (): SgfNode => {
    const node: SgfNode = {};
    while (i < n) {
      const c = text[i] as string;
      if (c === ";" || c === "(" || c === ")") break;
      if (/[A-Za-z]/.test(c)) {
        let id = "";
        while (i < n && /[A-Za-z]/.test(text[i] as string)) id += text[i++];
        id = id.replace(/[a-z]/g, "");
        const values: string[] = [];
        for (;;) {
          skipSpace();
          if (text[i] !== "[") break;
          i++;
          let v = "";
          while (i < n && text[i] !== "]") {
            if (text[i] === "\\" && i + 1 < n) {
              v += text[i + 1];
              i += 2;
            } else v += text[i++];
          }
          i++;
          values.push(v);
        }
        (node[id] ??= []).push(...values);
      } else i++;
    }
    return node;
  };

  const tree = (): SgfNode[] => {
    i++; // "("
    const nodes: SgfNode[] = [];
    let first: SgfNode[] | null = null;
    while (i < n) {
      const c = text[i] as string;
      if (c === ";") {
        i++;
        nodes.push(readNode());
      } else if (c === "(") {
        const child = tree();
        if (first === null) first = child;
      } else if (c === ")") {
        i++;
        break;
      } else i++;
    }
    return first ? nodes.concat(first) : nodes;
  };

  return tree();
}

function point(v: string): [number, number] | null {
  if (v.length < 2) return null;
  const x = LETTERS.indexOf(v[0] as string);
  const y = LETTERS.indexOf(v[1] as string);
  return x < 0 || y < 0 ? null : [x, y];
}

/** A list of points, where "aa:cc" is a rectangle. */
function expandPoints(values: readonly string[] | undefined): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const v of values ?? []) {
    const [a, b] = v.split(":");
    const p1 = point(a ?? "");
    if (!p1) continue;
    const p2 = b ? point(b) : null;
    if (!p2) {
      out.push(p1);
      continue;
    }
    for (let x = Math.min(p1[0], p2[0]); x <= Math.max(p1[0], p2[0]); x++)
      for (let y = Math.min(p1[1], p2[1]); y <= Math.max(p1[1], p2[1]); y++) out.push([x, y]);
  }
  return out;
}

/** Parse the main line of an SGF. Variations are ignored; handicap setup stones are kept. */
export function parseSGF(text: string): ParsedSGF {
  const nodes = mainLine(text);
  const root = nodes[0] ?? {};
  const szRaw = root["SZ"]?.[0] ?? "19";
  const [w, h] = szRaw.split(":");
  const size = Number(w);
  if (!Number.isInteger(size) || size < 2 || size > 26 || (h !== undefined && Number(h) !== size)) {
    throw new Error("Only square boards up to 26 x 26 are supported.");
  }
  const komiRaw = root["KM"]?.[0];
  const komi = komiRaw !== undefined && komiRaw.trim() !== "" && !Number.isNaN(Number(komiRaw)) ? Number(komiRaw) : undefined;
  const moves: ParsedSGF["moves"] = [];
  for (const node of nodes) {
    for (const key of ["B", "W"] as const) {
      const pos = node[key]?.[0];
      if (pos === undefined) continue;
      const color = key === "B" ? 1 : 2;
      // "tt" is the legacy pass marker on boards up to 19x19.
      const p = point(pos);
      if (pos === "" || (pos === "tt" && size <= 19) || p === null) moves.push({ color, move: { kind: "pass" } });
      else moves.push({ color, move: { kind: "play", x: p[0], y: p[1] } });
    }
  }
  const pl = root["PL"]?.[0];
  const info: SGFInfo = {};
  if (root["PB"]?.[0]) info.black = root["PB"][0];
  if (root["PW"]?.[0]) info.white = root["PW"][0];
  if (root["RE"]?.[0]) info.result = root["RE"][0];
  if (root["DT"]?.[0]) info.date = root["DT"][0];
  return {
    size,
    komi,
    moves,
    setup: { black: expandPoints(root["AB"]), white: expandPoints(root["AW"]) },
    toPlay: pl === "B" ? 1 : pl === "W" ? 2 : undefined,
    info,
  };
}

/** Replay an SGF and return every position: element 0 is the start, element i is after move i. */
export function replaySGFStates(text: string): { states: GameState[]; parsed: ParsedSGF } {
  const parsed = parseSGF(text);
  const size = parsed.size;
  const komi = parsed.komi;
  let state: GameState;
  const hasSetup = parsed.setup.black.length + parsed.setup.white.length > 0;
  if (hasSetup) {
    const board: Cell[] = new Array<Cell>(size * size).fill(0);
    for (const [x, y] of parsed.setup.black) if (x < size && y < size) board[y * size + x] = 1;
    for (const [x, y] of parsed.setup.white) if (x < size && y < size) board[y * size + x] = 2;
    const first = parsed.toPlay ?? parsed.moves[0]?.color ?? 2;
    state = createFromBoard(size, board, first, komi);
  } else {
    state = createGame({ size, ...(komi !== undefined ? { komi } : {}) });
  }
  const states: GameState[] = [state];
  parsed.moves.forEach((entry, i) => {
    // SGF can start with white or have passes out of turn; keep the engine in sync.
    if (state.toPlay !== entry.color) state = { ...state, toPlay: entry.color };
    const r = play(state, entry.move);
    if (!r.ok) throw new Error(`SGF move ${i + 1} is illegal: ${r.reason}`);
    state = r.state;
    states.push(state);
  });
  return { states, parsed };
}

/** Replay an SGF through the rules engine. Throws if a move is illegal. */
export function replaySGF(text: string): GameState {
  const { states } = replaySGFStates(text);
  return states[states.length - 1] as GameState;
}
