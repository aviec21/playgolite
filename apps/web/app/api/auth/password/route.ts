import { changePassword } from "../../../../lib/server/auth";
import { body, handler, json, str } from "../../../../lib/server/http";
import { requireUser } from "../../../../lib/server/session";

export const dynamic = "force-dynamic";

export const POST = handler(async (req) => {
  const user = await requireUser();
  const b = await body(req);
  await changePassword(user.id, str(b.current, 200), str(b.next, 200));
  return json({ ok: true });
});
