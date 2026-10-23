import { cancelGame, getGame } from "../../../../lib/server/games";
import { handler, json } from "../../../../lib/server/http";
import { currentUser, requireUser } from "../../../../lib/server/session";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Poll cheaply: pass ?rev=N and get {unchanged:true} if nothing moved. */
export const GET = handler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const user = await currentUser();
  const game = await getGame(id, user?.id ?? null);
  const rev = Number(new URL(req.url).searchParams.get("rev"));
  if (Number.isFinite(rev) && rev === game.rev) return json({ unchanged: true, serverNow: game.serverNow });
  return json({ game });
});

export const DELETE = handler(async (_req, ctx: Ctx) => {
  const { id } = await ctx.params;
  await cancelGame(await requireUser(), id);
  return json({ ok: true });
});
