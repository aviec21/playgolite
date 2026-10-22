import { Suspense } from "react";
import { ReviewRoute } from "../../components/ReviewRoute";

export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewRoute />
    </Suspense>
  );
}
