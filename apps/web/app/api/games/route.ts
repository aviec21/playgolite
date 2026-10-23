import { createGame, listGames } from "../../../lib/server/games";
import { body, handler, json } from "../../../lib/server/http";
import { requireUser } from "../../../lib/server/session";

export const dynamic = "force-dynamic";

export const GET = handler(async (req) => {
  const user = await requireUser();
  const scope = new URL(req.url).searchParams.get("scope") === "open" ? "open" : "mine";
  return json({ games: await listGames(user, scope) });
});

export const POST = handler(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  return json({ game: await createGame(user, { size: b.size, color: b.color, time: b.time }) });
});
