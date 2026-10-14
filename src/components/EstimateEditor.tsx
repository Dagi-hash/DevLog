"use client";

import { useState } from "react";
import { parseEstimate } from "@/lib/domain/validation";
import { cx } from "./ui";

/**
 * Inline minutes input for one estimate cell. Commits on Enter or blur and
 * reverts on Escape. `allowEmpty` lets a revised estimate be cleared (→ null).
 * Remount with a `key` tied to the stored value to pick up outside changes.
 */
export function EstimateEditor({
  value,
  label,
  allowEmpty = false,
  placeholder,
  onCommit,
}: {
  value: number | null;
  label: string;
  allowEmpty?: boolean;
  placeholder?: string;
  /** Returns an error message when the change was rejected. */
  onCommit: (minutes: number | null) => string | void;
}) {
  const initial = value === null ? "" : String(value);
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === initial) {
      setError(null);
      return;
    }
    let minutes: number | null;
    if (trimmed === "" && allowEmpty) minutes = null;
    else {
      minutes = parseEstimate(trimmed);
      if (minutes === null || trimmed === "") {
        setError("Whole minutes, 0 or more");
        return;
      }
    }
    const result = onCommit(minutes);
    if (typeof result === "string") setError(result);
    else setError(null);
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      aria-label={label}
      aria-invalid={error ? true : undefined}
      title={error ?? undefined}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => {
        setDraft(event.target.value);
        setError(null);
      }}
      onFocus={(event) => event.target.select()}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          (event.target as HTMLInputElement).blur();
        } else if (event.key === "Escape") {
          setDraft(initial);
          setError(null);
        }
      }}
      className={cx(
        "num h-9 w-[68px] rounded-none border-0 border-b bg-transparent px-1 text-right text-body text-fg placeholder:text-fg-4 transition-colors hover:border-fg-3 focus:border-fg focus:bg-surface focus:outline-none focus-visible:outline-none lg:h-8",
        error ? "border-fg border-dashed" : "border-border",
      )}
    />
  );
}
