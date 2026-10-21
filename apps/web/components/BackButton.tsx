"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * A "Back" button for the top bar. It always goes to a fixed parent page, so it behaves the
 * same however the person arrived. When `warn` is set, it asks before leaving.
 */
export function BackButton({
  href,
  label = "Back",
  warn,
}: {
  href: string;
  label?: string;
  /** Message to confirm before leaving, or undefined/null to leave straight away. */
  warn?: string | null;
}) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className="back"
      aria-label={`Back to ${label}`}
      onClick={(e) => {
        if (warn) {
          e.preventDefault();
          if (window.confirm(warn)) router.push(href);
        }
      }}
    >
      <span aria-hidden>&lsaquo;</span> {label}
    </Link>
  );
}
