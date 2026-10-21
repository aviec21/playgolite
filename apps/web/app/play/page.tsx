import { GameScreen } from "../../components/GameScreen";

import type { Level } from "@playgolite/ai";

const LEVEL_IDS = ["beginner", "easy", "medium", "hard", "expert", "master"];
const VALID = [9, 13, 19];

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string; resume?: string; vs?: string; level?: string; color?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.size);
  const size = VALID.includes(requested) ? requested : 9;
  const resume = params.resume === "1";
  const level = LEVEL_IDS.includes(params.level ?? "") ? (params.level as Level) : "easy";
  const ai = params.vs === "ai" ? { level, human: params.color === "white" ? 2 : params.color === "random" ? (Math.random() < 0.5 ? 1 : 2) : 1 } : null;
  // `key` makes "Play again" start from a clean state even though the route is the same.
  return <GameScreen key={`${size}-${resume}-${ai ? `${ai.level}${ai.human}` : "pvp"}`} size={size} resume={resume} ai={ai} />;
}
