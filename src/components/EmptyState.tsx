import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-11 place-items-center rounded-lg border border-line bg-surface text-fg-3 [&_svg]:size-5">{icon}</div>}
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      {children && <div className="mt-1.5 max-w-sm text-[14px] leading-relaxed text-fg-2">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
