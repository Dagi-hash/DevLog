import { cx } from "./ui";

/** DevLog identity: just ">Log", set in the serif. */
export function Wordmark({ className, title = "DevLog" }: { className?: string; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cx("font-serif text-[24px] leading-none tracking-[-0.02em] whitespace-nowrap text-fg", className)}
    >
      &gt;Log
    </span>
  );
}

/** Compact ">L" for the collapsed sidebar. */
export function Monogram({ className, title = "DevLog" }: { className?: string; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title}
      className={cx("font-serif text-[24px] leading-none tracking-[-0.02em] whitespace-nowrap text-fg", className)}
    >
      &gt;L
    </span>
  );
}
