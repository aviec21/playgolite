"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Level } from "@playgolite/ai";
import { GameScreen } from "./GameScreen";

const LEVEL_IDS = ["beginner", "easy", "medium", "hard", "expert", "master"];
const VALID = [9, 13, 19, 21];

export function PlayRoute() {
  const params = useSearchParams();
  const requested = Number(params.get("size"));
  const size = VALID.includes(requested) ? requested : 9;
  const resume = params.get("resume") === "1";
  const lv = params.get("level") ?? "";
  const level = (LEVEL_IDS.includes(lv) ? lv : "easy") as Level;
  const colorParam = params.get("color");
  // A random colour is drawn once and kept for as long as this page is open.
  const [coin] = useState(() => (Math.random() < 0.5 ? 1 : 2));
  const human = colorParam === "white" ? 2 : colorParam === "random" ? coin : 1;
  const ai = params.get("vs") === "ai" ? { level: level === "master" && size > 19 ? ("expert" as Level) : level, human } : null;
  // `key` makes "Play again" start from a clean state even though the route is the same.
  return <GameScreen key={`${size}-${resume}-${ai ? `${ai.level}${ai.human}` : "pvp"}`} size={size} resume={resume} ai={ai} />;
}
