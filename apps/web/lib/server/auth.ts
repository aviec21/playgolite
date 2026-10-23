import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import { isUniqueViolation, num, query } from "./db";
import { HttpError } from "./http";

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1 };
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
export const RECOVERY_CODE_COUNT = 8;

export interface User {
  id: string;
  username: string;
  rating: number;
  ratingDev: number;
  ratedGames: number;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, 32, { ...SCRYPT, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `s1$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [tag, saltB64, keyB64] = stored.split("$");
  if (tag !== "s1" || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// A hash to compare against when the username does not exist, so timing does not reveal it.
let dummyHash: Promise<string> | null = null;

export function validateUsername(raw: string): string {
  const name = raw.trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(name)) {
    throw new HttpError(400, "Usernames are 3 to 20 letters, numbers or underscores.");
  }
  return name;
}

export function validatePassword(pw: string): string {
  if (pw.length < 8) throw new HttpError(400, "Passwords need at least 8 characters.");
  if (pw.length > 128) throw new HttpError(400, "That password is too long.");
  return pw;
}

/** Count an attempt against a key. Throws 429 once `max` is passed inside the window. */
export async function limit(key: string, max: number, windowMs: number): Promise<void> {
  const now = Date.now();
  const rows = await query(
    `INSERT INTO pgl_limits (key, count, reset_at) VALUES ($1, 1, $2)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN pgl_limits.reset_at < $3 THEN 1 ELSE pgl_limits.count + 1 END,
       reset_at = CASE WHEN pgl_limits.reset_at < $3 THEN $2 ELSE pgl_limits.reset_at END
     RETURNING count, reset_at`,
    [key, now + windowMs, now],
  );
  const count = num(rows[0]?.count);
  if (count > max) {
    const wait = Math.max(1, Math.ceil((num(rows[0]?.reset_at) - now) / 60000));
    throw new HttpError(429, `Too many attempts. Try again in about ${wait} minute${wait === 1 ? "" : "s"}.`);
  }
}

export async function clearLimit(key: string): Promise<void> {
  await query(`DELETE FROM pgl_limits WHERE key = $1`, [key]);
}

export function newRecoveryCodes(): string[] {
  const codes: string[] = [];
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const bytes = randomBytes(10);
    let s = "";
    for (const b of bytes) s += CODE_ALPHABET[b % CODE_ALPHABET.length];
    codes.push(`${s.slice(0, 5)}-${s.slice(5)}`);
  }
  return codes;
}

const normCode = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");

async function storeRecoveryCodes(userId: string, codes: string[]): Promise<void> {
  await query(`DELETE FROM pgl_recovery WHERE user_id = $1`, [userId]);
  for (const c of codes) {
    await query(`INSERT INTO pgl_recovery (id, user_id, code_hash) VALUES ($1, $2, $3)`, [
      randomUUID(),
      userId,
      sha256(normCode(c)),
    ]);
  }
}

export async function createSession(userId: string): Promise<{ token: string; expires: number }> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const expires = now + SESSION_MS;
  await query(`INSERT INTO pgl_sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)`, [
    sha256(token),
    userId,
    now,
    expires,
  ]);
  return { token, expires };
}

export async function destroySession(token: string): Promise<void> {
  await query(`DELETE FROM pgl_sessions WHERE token_hash = $1`, [sha256(token)]);
}

const toUser = (r: Record<string, unknown>): User => ({
  id: String(r.id),
  username: String(r.username),
  rating: Math.round(num(r.rating)),
  ratingDev: Math.round(num(r.rating_dev)),
  ratedGames: num(r.rated_games),
});

export async function userForToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const rows = await query(
    `SELECT u.* FROM pgl_sessions s JOIN pgl_users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > $2`,
    [sha256(token), Date.now()],
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function register(
  username: string,
  password: string,
  ip: string,
): Promise<{ user: User; session: { token: string; expires: number }; recoveryCodes: string[] }> {
  const name = validateUsername(username);
  validatePassword(password);
  await limit(`register:${ip}`, 5, 60 * 60 * 1000);
  const id = randomUUID();
  const hash = await hashPassword(password);
  try {
    await query(
      `INSERT INTO pgl_users (id, username, username_lc, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)`,
      [id, name, name.toLowerCase(), hash, Date.now()],
    );
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError(409, "That username is taken.");
    throw e;
  }
  const codes = newRecoveryCodes();
  await storeRecoveryCodes(id, codes);
  const session = await createSession(id);
  const user = (await userForToken(session.token)) as User;
  return { user, session, recoveryCodes: codes };
}

export async function login(
  username: string,
  password: string,
  ip: string,
): Promise<{ user: User; session: { token: string; expires: number } }> {
  const name = username.trim().toLowerCase();
  await limit(`login-ip:${ip}`, 30, 15 * 60 * 1000);
  await limit(`login-user:${name}`, 8, 15 * 60 * 1000);
  const rows = await query(`SELECT * FROM pgl_users WHERE username_lc = $1`, [name]);
  const row = rows[0];
  dummyHash ??= hashPassword("not-a-real-password");
  const ok = await verifyPassword(password, row ? String(row.password_hash) : await dummyHash);
  if (!row || !ok) throw new HttpError(401, "Wrong username or password.");
  await clearLimit(`login-user:${name}`);
  await query(`UPDATE pgl_users SET last_login_at = $1 WHERE id = $2`, [Date.now(), row.id]);
  const session = await createSession(String(row.id));
  return { user: toUser(row), session };
}

/** Reset a forgotten password with one recovery code. The code is used up and every other session ends. */
export async function recover(
  username: string,
  code: string,
  newPassword: string,
  ip: string,
): Promise<{ user: User; session: { token: string; expires: number }; codesLeft: number }> {
  validatePassword(newPassword);
  const name = username.trim().toLowerCase();
  await limit(`recover-ip:${ip}`, 20, 60 * 60 * 1000);
  await limit(`recover-user:${name}`, 5, 60 * 60 * 1000);
  const rows = await query(`SELECT * FROM pgl_users WHERE username_lc = $1`, [name]);
  const row = rows[0];
  const hash = sha256(normCode(code));
  const used = row
    ? await query(
        `UPDATE pgl_recovery SET used_at = $1 WHERE user_id = $2 AND code_hash = $3 AND used_at IS NULL RETURNING id`,
        [Date.now(), row.id, hash],
      )
    : [];
  if (!row || used.length === 0) throw new HttpError(401, "That username and recovery code do not match.");
  await query(`UPDATE pgl_users SET password_hash = $1 WHERE id = $2`, [await hashPassword(newPassword), row.id]);
  await query(`DELETE FROM pgl_sessions WHERE user_id = $1`, [row.id]);
  await clearLimit(`recover-user:${name}`);
  const left = await query(`SELECT id FROM pgl_recovery WHERE user_id = $1 AND used_at IS NULL`, [row.id]);
  const session = await createSession(String(row.id));
  return { user: toUser(row), session, codesLeft: left.length };
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  validatePassword(next);
  await limit(`pw-change:${userId}`, 10, 60 * 60 * 1000);
  const rows = await query(`SELECT password_hash FROM pgl_users WHERE id = $1`, [userId]);
  if (!rows[0] || !(await verifyPassword(current, String(rows[0].password_hash)))) {
    throw new HttpError(401, "Your current password is not right.");
  }
  await query(`UPDATE pgl_users SET password_hash = $1 WHERE id = $2`, [await hashPassword(next), userId]);
}

/** Replace all recovery codes. Needs the password so a stolen session cannot do it. */
export async function regenerateRecoveryCodes(userId: string, password: string): Promise<string[]> {
  await limit(`codes:${userId}`, 5, 60 * 60 * 1000);
  const rows = await query(`SELECT password_hash FROM pgl_users WHERE id = $1`, [userId]);
  if (!rows[0] || !(await verifyPassword(password, String(rows[0].password_hash)))) {
    throw new HttpError(401, "That password is not right.");
  }
  const codes = newRecoveryCodes();
  await storeRecoveryCodes(userId, codes);
  return codes;
}

export async function recoveryCodesLeft(userId: string): Promise<number> {
  return (await query(`SELECT id FROM pgl_recovery WHERE user_id = $1 AND used_at IS NULL`, [userId])).length;
}
