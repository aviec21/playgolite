import { recoveryCodesLeft } from "../../../../lib/server/auth";
import { handler, json } from "../../../../lib/server/http";
import { currentUser } from "../../../../lib/server/session";

export const dynamic = "force-dynamic";

export const GET = handler(async () => {
  const user = await currentUser();
  return json({ user, codesLeft: user ? await recoveryCodesLeft(user.id) : null });
});
