"use client";

import { useSearchParams } from "next/navigation";
import { ReviewScreen } from "./ReviewScreen";

export function ReviewRoute() {
  const id = useSearchParams().get("id") ?? "";
  return <ReviewScreen key={id} id={id} />;
}
