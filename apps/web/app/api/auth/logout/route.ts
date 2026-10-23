import { destroySession } from "../../../../lib/server/auth";
import { handler, json } from "../../../../lib/server/http";
import { clearSessionCookie, currentToken } from "../../../../lib/server/session";

export const dynamic = "force-dynamic";

export const POST = handler(async () => {
  const t = await currentToken();
  if (t) await destroySession(t);
  await clearSessionCookie();
  return json({ ok: true });
});
