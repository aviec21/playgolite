import { Suspense } from "react";
import { PlayRoute } from "../../components/PlayRoute";

// The page itself is static; the options in the address are read in the browser. That lets the
// offline copy of this page serve every game setup.
export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayRoute />
    </Suspense>
  );
}
