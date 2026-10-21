import { GameScreen } from "@/components/GameScreen";

const VALID = [9, 13, 19];

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ size?: string; resume?: string }>;
}) {
  const params = await searchParams;
  const requested = Number(params.size);
  const size = VALID.includes(requested) ? requested : 9;
  const resume = params.resume === "1";
  // `key` makes "Play again" start from a clean state even though the route is the same.
  return <GameScreen key={`${size}-${resume}`} size={size} resume={resume} />;
}
