"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { WORK_MODE_INFO, STATUS_LABEL, type ProjectStatus, type WorkMode } from "@/lib/domain/psp";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-strong active:bg-accent disabled:bg-raised disabled:text-fg-3",
  secondary:
    "bg-raised text-fg border border-line-strong hover:bg-[#283043] disabled:text-fg-3 disabled:hover:bg-raised",
  ghost: "text-fg-2 hover:text-fg hover:bg-white/[0.045] disabled:text-fg-3 disabled:hover:bg-transparent",
  danger: "bg-danger-soft text-danger hover:bg-[rgb(236_122_116/0.2)] disabled:opacity-50",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-sm",
  md: "h-10 px-3.5 text-sm gap-2 rounded-md",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-md",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

const controlBase =
  "w-full rounded-md border bg-surface px-3 text-[15px] sm:text-sm text-fg placeholder:text-fg-3 transition-colors duration-150 hover:border-line-strong focus:border-accent/70 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-accent/25 disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-fg-2">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextInput({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx(controlBase, "h-10", invalid ? "border-danger/70" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function TextArea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cx(controlBase, "min-h-[72px] resize-y py-2 leading-snug", invalid ? "border-danger/70" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ invalid, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cx(controlBase, "app-select h-10 cursor-pointer truncate", invalid ? "border-danger/70" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Segmented control (radio group)
// ---------------------------------------------------------------------------

export function Segmented<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
  className,
  size = "md",
}: {
  label: string;
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex rounded-md border border-line bg-surface p-0.5", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cx(
              "relative flex flex-1 cursor-pointer items-center justify-center rounded-[7px] text-center font-medium whitespace-nowrap transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-9 px-3 text-[13.5px]",
              selected ? "bg-raised text-fg shadow-[0_1px_0_rgb(255_255_255/0.04)_inset]" : "text-fg-2 hover:text-fg",
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small labels
// ---------------------------------------------------------------------------

const modeDot: Record<WorkMode, string> = {
  manual: "bg-mode-manual",
  ai_assisted: "bg-mode-assisted",
  ai_agent: "bg-mode-agent",
};

export function ModeDot({ mode, className }: { mode: WorkMode; className?: string }) {
  return <span aria-hidden className={cx("inline-block size-1.5 shrink-0 rounded-full", modeDot[mode], className)} />;
}

export function ModeTag({ mode, short = false }: { mode: WorkMode; short?: boolean }) {
  const info = WORK_MODE_INFO[mode];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] whitespace-nowrap text-fg-2">
      <ModeDot mode={mode} />
      {short ? info.short : info.label}
    </span>
  );
}

const statusClass: Record<ProjectStatus, string> = {
  active: "text-under bg-under-soft",
  completed: "text-accent bg-accent-soft",
  archived: "text-fg-3 bg-white/[0.05]",
};

export function StatusPill({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cx(
        "inline-flex h-5 items-center rounded-full px-2 text-[11.5px] font-medium tracking-wide whitespace-nowrap",
        statusClass[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

/** Thin actual-vs-plan bar. Overrun beyond the plan is drawn in the "over" colour. */
export function ProgressBar({ actual, planned, className, label }: { actual: number; planned: number; className?: string; label: string }) {
  const scale = Math.max(actual, planned, 1);
  const within = Math.min(actual, planned);
  const over = Math.max(0, actual - planned);
  return (
    <div
      role="img"
      aria-label={label}
      className={cx("relative h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]", className)}
    >
      {planned > 0 && (
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-white/[0.07]"
          style={{ width: `${(planned / scale) * 100}%` }}
        />
      )}
      <div className="absolute inset-y-0 left-0 bg-accent/85" style={{ width: `${(within / scale) * 100}%` }} />
      {over > 0 && (
        <div
          className="absolute inset-y-0 bg-over/90"
          style={{ left: `${(within / scale) * 100}%`, width: `${(over / scale) * 100}%` }}
        />
      )}
    </div>
  );
}

export function SectionHeading({ title, aside, id }: { title: string; aside?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 id={id} className="text-[13px] font-semibold tracking-wide text-fg-2 uppercase">
        {title}
      </h2>
      {aside}
    </div>
  );
}

export function InlineAlert({ tone = "danger", children }: { tone?: "danger" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cx(
        "rounded-md px-3 py-2 text-[13.5px] leading-snug",
        tone === "danger" ? "bg-danger-soft text-danger" : "bg-accent-soft text-accent-strong",
      )}
    >
      {children}
    </div>
  );
}
