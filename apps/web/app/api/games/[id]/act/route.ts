import { act, type Action } from "../../../../../lib/server/games";
import { HttpError, body, handler, json } from "../../../../../lib/server/http";
import { requireUser } from "../../../../../lib/server/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const { id } = await ctx.params;
  const user = await requireUser();
  const b = await body(req);
  const n = (v: unknown) => (typeof v === "number" ? v : NaN);
  let action: Action;
  switch (b.type) {
    case "move":
      action = { type: "move", x: n(b.x), y: n(b.y), expect: n(b.expect) };
      break;
    case "pass":
      action = { type: "pass", expect: n(b.expect) };
      break;
    case "mark":
      action = { type: "mark", x: n(b.x), y: n(b.y) };
      break;
    case "resign":
    case "accept":
    case "resume":
      action = { type: b.type };
      break;
    default:
      throw new HttpError(400, "Unknown action.");
  }
  return json({ game: await act(user, id, action) });
});
