import { cx } from "./ui";

/**
 * DevLog identity: a prompt chevron followed by "Log", drawn as monoline
 * geometry so it never depends on a font. The "o" is a clock face with a single
 * hand: a log of time.
 */
export function Wordmark({ className, title = "DevLog" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 44 25"
      role="img"
      aria-label={title}
      className={cx("h-[18px] w-auto shrink-0 text-fg", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* > */}
      <path d="M2.2 6.2 8.6 12 2.2 17.8" strokeWidth="2.4" />
      {/* L */}
      <path d="M13.4 4v14h6.4" strokeWidth="2.4" />
      {/* o: clock face */}
      <circle cx="26.4" cy="14" r="4" strokeWidth="2.4" />
      <path d="M26.4 14v-1.9" strokeWidth="1.5" />
      {/* g */}
      <circle cx="37.2" cy="14" r="4" strokeWidth="2.4" />
      <path d="M41.2 10v8.9a3.6 3.6 0 0 1-3.6 3.6h-3" strokeWidth="2.4" />
    </svg>
  );
}

/** Compact monogram (">L") for the collapsed sidebar and app icon. */
export function Monogram({ className, title = "DevLog" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={cx("size-6 shrink-0 text-fg", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.5 7.2 9.3 12l-4.8 4.8" strokeWidth="2.2" />
      <path d="M13.5 5.5v13h6" strokeWidth="2.2" />
    </svg>
  );
}
