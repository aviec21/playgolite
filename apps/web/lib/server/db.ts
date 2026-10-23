/**
 * Database access. In production this is Neon Postgres over HTTP (set DATABASE_URL or POSTGRES_URL).
 * Without a connection string outside production it falls back to PGlite, a Postgres that runs
 * inside the process, so the whole feature can be developed and tested with nothing installed.
 */
export type Row = Record<string, unknown>;

interface Driver {
  query(text: string, params?: unknown[]): Promise<Row[]>;
}

export class DatabaseNotConfigured extends Error {
  constructor() {
    super("The database is not configured.");
  }
}

const globalForDb = globalThis as unknown as { __pglDriver?: Promise<Driver> };

function connectionString(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

/** Each entry is applied once, in order. Statements must be safe to run twice. */
const MIGRATIONS: string[][] = [
  [
    `CREATE TABLE IF NOT EXISTS pgl_users (
      id text PRIMARY KEY,
      username text NOT NULL,
      username_lc text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at bigint NOT NULL,
      last_login_at bigint,
      rating real NOT NULL DEFAULT 1500,
      rating_dev real NOT NULL DEFAULT 350,
      rating_vol real NOT NULL DEFAULT 0.06,
      rated_games int NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS pgl_recovery (
      id text PRIMARY KEY,
      user_id text NOT NULL REFERENCES pgl_users(id) ON DELETE CASCADE,
      code_hash text NOT NULL,
      used_at bigint
    )`,
    `CREATE INDEX IF NOT EXISTS pgl_recovery_user ON pgl_recovery(user_id)`,
    `CREATE TABLE IF NOT EXISTS pgl_sessions (
      token_hash text PRIMARY KEY,
      user_id text NOT NULL REFERENCES pgl_users(id) ON DELETE CASCADE,
      created_at bigint NOT NULL,
      expires_at bigint NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS pgl_sessions_user ON pgl_sessions(user_id)`,
    `CREATE TABLE IF NOT EXISTS pgl_limits (
      key text PRIMARY KEY,
      count int NOT NULL,
      reset_at bigint NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS pgl_games (
      id text PRIMARY KEY,
      size int NOT NULL,
      komi real NOT NULL,
      creator_id text NOT NULL REFERENCES pgl_users(id),
      creator_color text NOT NULL,
      black_id text REFERENCES pgl_users(id),
      white_id text REFERENCES pgl_users(id),
      status text NOT NULL,
      tc_kind text NOT NULL,
      tc_main_ms bigint NOT NULL,
      tc_inc_ms bigint NOT NULL,
      moves text NOT NULL DEFAULT '',
      move_count int NOT NULL DEFAULT 0,
      black_ms bigint NOT NULL DEFAULT 0,
      white_ms bigint NOT NULL DEFAULT 0,
      turn_started_at bigint,
      dead text NOT NULL DEFAULT '',
      accept_black boolean NOT NULL DEFAULT false,
      accept_white boolean NOT NULL DEFAULT false,
      scoring_started_at bigint,
      resumes int NOT NULL DEFAULT 0,
      rev int NOT NULL DEFAULT 0,
      result text,
      rated boolean NOT NULL DEFAULT true,
      created_at bigint NOT NULL,
      finished_at bigint
    )`,
    `CREATE INDEX IF NOT EXISTS pgl_games_black ON pgl_games(black_id)`,
    `CREATE INDEX IF NOT EXISTS pgl_games_white ON pgl_games(white_id)`,
    `CREATE INDEX IF NOT EXISTS pgl_games_creator ON pgl_games(creator_id)`,
  ],
];

async function migrate(d: Driver): Promise<void> {
  await d.query(`CREATE TABLE IF NOT EXISTS pgl_meta (key text PRIMARY KEY, value text NOT NULL)`);
  const rows = await d.query(`SELECT value FROM pgl_meta WHERE key = 'schema'`);
  let version = rows[0] ? Number(rows[0].value) : 0;
  while (version < MIGRATIONS.length) {
    for (const statement of MIGRATIONS[version] as string[]) await d.query(statement);
    version++;
    await d.query(
      `INSERT INTO pgl_meta (key, value) VALUES ('schema', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [String(version)],
    );
  }
}

async function makeDriver(): Promise<Driver> {
  const url = connectionString();
  let d: Driver;
  if (url) {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    d = { query: async (text, params) => (await sql.query(text, params ?? [])) as Row[] };
  } else {
    if (process.env.NODE_ENV === "production") throw new DatabaseNotConfigured();
    const { PGlite } = await import("@electric-sql/pglite");
    const db = new PGlite(process.env.PGLITE_DIR || undefined);
    await db.waitReady;
    d = { query: async (text, params) => (await db.query(text, params ?? [])).rows as Row[] };
  }
  await migrate(d);
  return d;
}

function driver(): Promise<Driver> {
  if (!globalForDb.__pglDriver) {
    globalForDb.__pglDriver = makeDriver().catch((e) => {
      globalForDb.__pglDriver = undefined; // try again on the next request
      throw e;
    });
  }
  return globalForDb.__pglDriver;
}

export async function query(text: string, params: unknown[] = []): Promise<Row[]> {
  return (await driver()).query(text, params);
}

/** Postgres returns bigint columns as strings. */
export const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));

export function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  return err?.code === "23505" || /unique|duplicate key/i.test(err?.message ?? "");
}
