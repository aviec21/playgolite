import { register } from "../../../../lib/server/auth";
import { body, clientIp, handler, json, str } from "../../../../lib/server/http";
import { setSessionCookie } from "../../../../lib/server/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const b = await body(req);
  const r = await register(str(b.username), str(b.password, 200), clientIp(req));
  await setSessionCookie(r.session.token, r.session.expires);
  return json({ user: r.user, recoveryCodes: r.recoveryCodes });
});
