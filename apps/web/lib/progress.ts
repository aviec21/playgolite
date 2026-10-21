"use client";

import { useCallback, useEffect, useState } from "react";

export const LESSONS_KEY = "playgolite:lessons-done";
export const PUZZLES_KEY = "playgolite:puzzles-solved";

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** A set of completed ids saved on this device. Loads after mount to avoid hydration mismatches. */
export function useProgress(key: string): { done: ReadonlySet<string>; markDone: (id: string) => void } {
  const [done, setDone] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    setDone(new Set(read(key)));
  }, [key]);

  const markDone = useCallback(
    (id: string) => {
      const current = new Set(read(key));
      current.add(id);
      try {
        localStorage.setItem(key, JSON.stringify([...current]));
      } catch {
        /* storage may be unavailable */
      }
      setDone(current);
    },
    [key],
  );

  return { done, markDone };
}
