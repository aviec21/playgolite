import { NextResponse } from "next/server";
import { DatabaseNotConfigured } from "./db";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** Wrap a route handler so errors become JSON and state-changing requests must come from this site. */
export function handler<A extends unknown[]>(fn: (req: Request, ...rest: A) => Promise<NextResponse>) {
  return async (req: Request, ...rest: A): Promise<NextResponse> => {
    try {
      if (req.method !== "GET" && req.method !== "HEAD") {
        const origin = req.headers.get("origin");
        const host = req.headers.get("host");
        if (origin && host) {
          let originHost = "";
          try {
            originHost = new URL(origin).host;
          } catch {
            /* fall through to the check below */
          }
          if (originHost !== host) throw new HttpError(403, "Cross-site requests are not allowed.");
        }
      }
      return await fn(req, ...rest);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, ...(e.extra ?? {}) }, e.status);
      if (e instanceof DatabaseNotConfigured) {
        return json({ error: "Online play is not set up on this server yet.", code: "no-database" }, 503);
      }
      console.error(e);
      return json({ error: "Something went wrong. Please try again." }, 500);
    }
  };
}

export async function body(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text();
  if (text.length > 20_000) throw new HttpError(413, "That request is too large.");
  try {
    const v = JSON.parse(text || "{}") as unknown;
    if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    /* handled below */
  }
  throw new HttpError(400, "The request was not valid JSON.");
}

export const str = (v: unknown, max = 200): string => (typeof v === "string" ? v.slice(0, max) : "");

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}
