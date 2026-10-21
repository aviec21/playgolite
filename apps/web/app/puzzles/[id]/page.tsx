import { notFound } from "next/navigation";
import { PUZZLES } from "@playgolite/learn";
import { PuzzlePlayer } from "../../../components/PuzzlePlayer";

export function generateStaticParams() {
  return PUZZLES.map((p) => ({ id: p.id }));
}

export default async function PuzzlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = PUZZLES.findIndex((p) => p.id === id);
  const puzzle = PUZZLES[i];
  if (!puzzle) notFound();
  const next = PUZZLES[i + 1];
  return <PuzzlePlayer key={puzzle.id} puzzle={puzzle} nextId={next ? next.id : null} />;
}
