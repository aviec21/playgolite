import { cookies } from "next/headers";
import { userForToken, type User } from "./auth";
import { HttpError } from "./http";

export const COOKIE = "pgl_session";

export async function setSessionCookie(token: string, expires: number): Promise<void> {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function currentToken(): Promise<string | undefined> {
  return (await cookies()).get(COOKIE)?.value;
}

export async function currentUser(): Promise<User | null> {
  return userForToken(await currentToken());
}

export async function requireUser(): Promise<User> {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Please sign in first.", { code: "signed-out" });
  return u;
}
