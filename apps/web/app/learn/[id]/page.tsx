import { notFound } from "next/navigation";
import { LESSONS } from "@playgolite/learn";
import { LessonPlayer } from "../../../components/LessonPlayer";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export default async function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const i = LESSONS.findIndex((l) => l.id === id);
  const lesson = LESSONS[i];
  if (!lesson) notFound();
  const next = LESSONS[i + 1];
  return <LessonPlayer key={lesson.id} lesson={lesson} nextId={next ? next.id : null} />;
}
