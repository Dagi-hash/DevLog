import type { ReactNode } from "react";

/** Concise, left-aligned empty state: a statement, one line of help, one action. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-t border-hairline py-10">
      <p className="text-lead font-medium text-fg">{title}</p>
      {children && <div className="mt-1.5 max-w-md text-body leading-relaxed text-fg-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
