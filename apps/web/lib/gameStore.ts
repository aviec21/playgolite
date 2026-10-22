/** Finished and imported games, kept on this device. */
export interface SavedGame {
  id: string;
  sgf: string;
  savedAt: number;
  black: string;
  white: string;
  /** SGF result text such as "B+R", "W+3.5" or "0". */
  result: string;
  size: number;
  moves: number;
  source: "played" | "imported";
}

const KEY = "playgolite:games";
const MAX_GAMES = 100;

export function listGames(): SavedGame[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]") as SavedGame[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function write(games: SavedGame[]): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(games.slice(0, MAX_GAMES)));
    return true;
  } catch {
    return false;
  }
}

export function addGame(game: Omit<SavedGame, "id" | "savedAt">): SavedGame {
  const entry: SavedGame = {
    ...game,
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    savedAt: Date.now(),
  };
  write([entry, ...listGames()]);
  return entry;
}

export function getGame(id: string): SavedGame | null {
  return listGames().find((g) => g.id === id) ?? null;
}

export function removeGame(id: string): void {
  write(listGames().filter((g) => g.id !== id));
}

/** Plain-words version of an SGF RE value. */
export function describeSgfResult(re: string | undefined): string {
  if (!re) return "No result";
  const r = re.trim();
  if (r === "0" || r.toLowerCase() === "draw") return "Draw";
  const m = /^([BW])\+(.*)$/i.exec(r);
  if (!m) return r;
  const who = m[1]!.toUpperCase() === "B" ? "Black" : "White";
  const how = (m[2] ?? "").trim();
  if (how.toUpperCase() === "R") return `${who} wins by resignation`;
  if (how.toUpperCase() === "T") return `${who} wins on time`;
  if (how === "" ) return `${who} wins`;
  return `${who} wins by ${how}`;
}
