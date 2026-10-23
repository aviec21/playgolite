import { joinGame } from "../../../../../lib/server/games";
import { handler, json } from "../../../../../lib/server/http";
import { requireUser } from "../../../../../lib/server/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  return json({ game: await joinGame(await requireUser(), id) });
});
