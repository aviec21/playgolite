"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountUser } from "./onlineShared";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      cache: "no-store",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.", "offline");
  }
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    throw new ApiError(res.status, typeof data.error === "string" ? data.error : "Something went wrong.", data.code as string | undefined);
  }
  return data as T;
}

/** The signed-in account. `undefined` while loading, `null` when signed out. */
export function useMe() {
  const [user, setUser] = useState<AccountUser | null | undefined>(undefined);
  const [codesLeft, setCodesLeft] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: AccountUser | null; codesLeft: number | null }>("/api/auth/me");
      setUser(r.user);
      setCodesLeft(r.codesLeft);
      setProblem(null);
    } catch (e) {
      setUser(null);
      setProblem(e instanceof ApiError ? e.message : "Could not check your sign-in.");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { user, codesLeft, problem, refresh, setUser, setCodesLeft };
}
