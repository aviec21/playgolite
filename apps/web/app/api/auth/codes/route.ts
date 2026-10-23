import { regenerateRecoveryCodes } from "../../../../lib/server/auth";
import { body, handler, json, str } from "../../../../lib/server/http";
import { requireUser } from "../../../../lib/server/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  return json({ recoveryCodes: await regenerateRecoveryCodes(user.id, str(b.password, 200)) });
});
