"use client";

import { Archive, Check, CircleAlert } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { STATUS_LABEL, WORK_MODE_INFO, type ProjectStatus, type WorkMode } from "@/lib/domain/psp";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-inverse text-inverse-fg hover:bg-inverse-hover active:bg-inverse-press disabled:bg-elevated disabled:text-fg-3",
  secondary:
    "border border-border text-fg hover:border-border-strong hover:bg-hover active:bg-press disabled:text-fg-4 disabled:hover:bg-transparent",
  ghost: "text-fg-2 hover:text-fg hover:bg-hover active:bg-press disabled:text-fg-4",
  // Destructive actions are told apart by their explicit label and outline, not colour.
  destructive:
    "border border-fg-3 text-fg underline-offset-4 hover:border-fg hover:bg-hover active:bg-press disabled:opacity-50",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-meta gap-1.5",
  md: "h-11 px-4 text-body gap-2 sm:h-10",
  lg: "h-12 px-6 text-lead gap-2.5",
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
        "inline-flex shrink-0 items-center justify-center rounded-sm font-medium whitespace-nowrap transition-colors duration-150 select-none disabled:cursor-not-allowed [&_svg]:size-4 [&_svg]:shrink-0",
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
  "w-full rounded-sm border bg-canvas px-3 text-input sm:text-body text-fg placeholder:text-fg-4 transition-colors duration-150 hover:border-border-strong focus:border-fg focus:outline-none focus-visible:outline-none disabled:opacity-50";

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
      <label htmlFor={htmlFor} className="text-meta text-fg-2">
        {label}
      </label>
      {children}
      {error ? (
        <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
      ) : hint ? (
        <p className="text-meta text-fg-3">{hint}</p>
      ) : null}
    </div>
  );
}

export function FieldError({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="flex items-start gap-1.5 text-meta text-fg">
      <CircleAlert className="mt-[2px] size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

export function TextInput({ invalid, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      className={cx(controlBase, "h-11", invalid ? "border-fg" : "border-border", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function TextArea({ invalid, className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cx(controlBase, "min-h-[76px] resize-y py-2.5 leading-snug", invalid ? "border-fg" : "border-border", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function Select({ invalid, className, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cx(controlBase, "app-select h-11 cursor-pointer truncate", invalid ? "border-fg" : "border-border", className)}
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
}: {
  label: string;
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx("flex rounded-sm border border-border p-[3px]", className)}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cx(
              "relative flex h-10 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xs px-3 text-body whitespace-nowrap transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fg sm:h-9",
              selected ? "bg-elevated font-medium text-fg" : "text-fg-3 hover:text-fg-2",
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

/** Text tabs with an underline for the selected option (radio semantics). */
export function TabFilter<T extends string>({
  label,
  name,
  value,
  options,
  onChange,
}: {
  label: string;
  name: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  onChange: (value: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-6 border-b border-hairline sm:gap-8">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <label
            key={option.value}
            className={cx(
              "relative -mb-px flex h-11 cursor-pointer items-center gap-2 border-b-2 text-body transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-fg",
              selected ? "border-fg font-medium text-fg" : "border-transparent text-fg-3 hover:text-fg-2",
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
            {option.count !== undefined && <span className="num font-mono text-meta text-fg-3">{option.count}</span>}
          </label>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Work modes & status: shape, not colour
// ---------------------------------------------------------------------------

/** Manual = ring, AI-Assisted = half-filled, AI-Agent = filled. */
export function ModeGlyph({ mode, className }: { mode: WorkMode; className?: string }) {
  return (
    <svg viewBox="0 0 10 10" aria-hidden className={cx("size-2.5 shrink-0", className)}>
      <circle cx="5" cy="5" r="4" fill={mode === "ai_agent" ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.3" />
      {mode === "ai_assisted" && <path d="M5 1a4 4 0 0 1 0 8z" fill="currentColor" />}
    </svg>
  );
}

export function ModeTag({ mode, short = false, className }: { mode: WorkMode; short?: boolean; className?: string }) {
  const info = WORK_MODE_INFO[mode];
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-meta whitespace-nowrap text-fg-2", className)}>
      <ModeGlyph mode={mode} />
      {short ? info.short : info.label}
    </span>
  );
}

export function StatusLabel({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={cx(
        "inline-flex h-6 items-center gap-1.5 rounded-xs border px-2 text-meta whitespace-nowrap",
        status === "active" ? "border-border text-fg" : "border-hairline text-fg-3",
      )}
    >
      {status === "active" && <span aria-hidden className="size-1.5 rounded-full bg-fg" />}
      {status === "completed" && <Check className="size-3" aria-hidden />}
      {status === "archived" && <Archive className="size-3" aria-hidden />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export function RecordingDot({ className }: { className?: string }) {
  return <span aria-hidden className={cx("inline-block size-2 shrink-0 animate-pulse-dot rounded-full bg-fg", className)} />;
}

/** Thin actual-vs-plan bar. The over-plan portion is hatched so it reads without colour. */
export function ProgressBar({ actual, planned, className, label }: { actual: number; planned: number; className?: string; label: string }) {
  const scale = Math.max(actual, planned, 1);
  const within = Math.min(actual, planned);
  const over = Math.max(0, actual - planned);
  return (
    <div role="img" aria-label={label} className={cx("relative h-[3px] w-full bg-elevated", className)}>
      <div className="absolute inset-y-0 left-0 bg-fg" style={{ width: `${(within / scale) * 100}%` }} />
      {over > 0 && (
        <div className="hatch absolute -inset-y-px" style={{ left: `${(within / scale) * 100}%`, width: `${(over / scale) * 100}%` }} />
      )}
      {planned > 0 && planned < scale && (
        <div className="absolute -inset-y-1 w-px bg-fg-2" style={{ left: `${(planned / scale) * 100}%` }} />
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {eyebrow && <p className="micro mb-2">{eyebrow}</p>}
        <h1 className="text-title font-semibold tracking-[-0.02em] break-words text-fg">{title}</h1>
      </div>
      {children}
    </header>
  );
}

export function SectionLabel({ children, aside, id }: { children: ReactNode; aside?: ReactNode; id?: string }) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-4 border-b border-hairline pb-2">
      <h2 id={id} className="micro">
        {children}
      </h2>
      {aside}
    </div>
  );
}

export function InlineAlert({ tone = "error", children }: { tone?: "error" | "info"; children: ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cx(
        "flex items-start gap-2.5 border-l-2 bg-canvas/60 py-2.5 pr-3 pl-3 text-body leading-snug",
        tone === "error" ? "border-fg text-fg" : "border-fg-3 text-fg-2",
      )}
    >
      {tone === "error" && <CircleAlert className="mt-[2px] size-4 shrink-0" aria-hidden />}
      <div>{children}</div>
    </div>
  );
}
