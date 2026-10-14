"use client";

import { FolderClosed, ScrollText, Settings2, Timer, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { elapsedSeconds } from "@/lib/domain/calculations";
import { formatClock } from "@/lib/domain/format";
import type { AppData } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { dismissIssue, useStoreState } from "@/lib/state/store";
import { RecordingDot, cx } from "./ui";

const PRIMARY_NAV = [
  { href: "/", label: "Today", icon: Timer },
  { href: "/projects", label: "Projects", icon: FolderClosed },
  { href: "/log", label: "Time log", icon: ScrollText },
] as const;

const SETTINGS = { href: "/settings", label: "Settings", icon: Settings2 } as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** "12:04" under an hour, "1:12:04" beyond. Compact enough for the rail and pill. */
function compactClock(seconds: number) {
  const full = formatClock(seconds);
  return seconds < 3600 ? full.slice(3) : full.replace(/^0/, "");
}

export function AppShell({ children }: { children: ReactNode }) {
  const state = useStoreState();
  const pathname = usePathname();
  const timerData = state?.data.activeTimer ? state.data : null;

  return (
    <div className="min-h-dvh">
      {/* Desktop: compact navigation rail */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[var(--rail-width)] flex-col items-center border-r border-hairline bg-canvas py-5 md:flex">
        <Link href="/" aria-label="PSP Workbench — Today" className="mb-8 rounded-sm p-1">
          <Mark />
        </Link>
        <nav aria-label="Main" className="flex w-full flex-col items-stretch gap-1">
          {PRIMARY_NAV.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ))}
        </nav>
        <div className="mt-auto flex w-full flex-col items-stretch gap-4">
          {timerData && <RailTimer data={timerData} active={pathname === "/"} />}
          <RailLink item={SETTINGS} active={isActive(pathname, SETTINGS.href)} />
        </div>
      </aside>

      {/* Mobile: top bar with session indicator and settings */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/95 pt-[var(--safe-top)] backdrop-blur-sm md:hidden">
        <div className="flex h-[var(--mobile-bar-height)] items-center justify-between gap-3 pr-1.5 pl-4">
          <Link href="/" className="flex h-11 items-center gap-2.5" aria-label="PSP Workbench — Today">
            <Mark />
            <span className="text-body font-semibold tracking-[-0.01em]">PSP Workbench</span>
          </Link>
          <div className="flex min-w-0 items-center gap-1">
            {timerData && pathname !== "/" && <SessionPill data={timerData} />}
            <Link
              href={SETTINGS.href}
              aria-label="Settings"
              aria-current={isActive(pathname, SETTINGS.href) ? "page" : undefined}
              className={cx(
                "grid size-11 place-items-center rounded-sm transition-colors",
                isActive(pathname, SETTINGS.href) ? "text-fg" : "text-fg-3 hover:text-fg",
              )}
            >
              <Settings2 className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="md:pl-[var(--rail-width)]">
        <div className="mx-auto w-full max-w-[1200px] px-5 pt-6 pb-[calc(var(--mobile-nav-height)+var(--safe-bottom)+40px)] md:px-10 md:pt-12 md:pb-20 xl:px-14">
          {state?.issue && <IssueBanner message={state.issue} />}
          {state ? children : <LoadingState />}
        </div>
      </main>

      {/* Mobile: bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-canvas/95 pb-[var(--safe-bottom)] backdrop-blur-sm md:hidden"
      >
        <ul className="grid h-[var(--mobile-nav-height)] grid-cols-3">
          {PRIMARY_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex h-full flex-col items-center justify-center gap-1 text-tiny font-medium transition-colors",
                    active ? "text-fg" : "text-fg-3",
                  )}
                >
                  {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 bg-fg" />}
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.6} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {timerData && <TitleTicker data={timerData} />}
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
      <rect x="0.75" y="0.75" width="22.5" height="22.5" rx="5" fill="none" stroke="var(--color-border)" strokeWidth="1.5" />
      <path d="M7.5 16.5v-9h4.2a2.8 2.8 0 0 1 0 5.6H7.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
      <path d="M14.2 16.5h2.6" stroke="var(--color-fg-3)" strokeWidth="1.8" strokeLinecap="square" />
    </svg>
  );
}

function RailLink({
  item,
  active,
}: {
  item: { href: string; label: string; icon: typeof Timer };
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "relative mx-2 flex flex-col items-center gap-1.5 rounded-sm py-2.5 text-tiny font-medium transition-colors",
        active ? "bg-surface text-fg" : "text-fg-3 hover:bg-hover hover:text-fg-2",
      )}
    >
      {active && <span aria-hidden className="absolute top-2.5 bottom-2.5 -left-2 w-0.5 bg-fg" />}
      <Icon className="size-[19px]" strokeWidth={active ? 2 : 1.6} aria-hidden />
      {item.label}
    </Link>
  );
}

function RailTimer({ data, active }: { data: AppData; active: boolean }) {
  const now = useNow();
  const timer = data.activeTimer!;
  return (
    <Link
      href="/"
      aria-label={`Session running: ${timer.phase}. Open Today.`}
      className={cx(
        "mx-2 flex flex-col items-center gap-1.5 rounded-sm border py-2.5 transition-colors",
        active ? "border-hairline" : "border-border hover:border-border-strong",
      )}
    >
      <RecordingDot className="size-1.5" />
      <span className="num font-mono text-tiny text-fg">{compactClock(elapsedSeconds(timer.startedAt, now))}</span>
    </Link>
  );
}

function SessionPill({ data }: { data: AppData }) {
  const now = useNow();
  const timer = data.activeTimer!;
  return (
    <Link
      href="/"
      aria-label={`Session running for ${timer.phase}. Open Today.`}
      className="flex h-9 min-w-0 items-center gap-2 rounded-sm border border-border pr-3 pl-2.5 text-meta"
    >
      <RecordingDot className="size-1.5" />
      <span className="num font-mono text-fg">{compactClock(elapsedSeconds(timer.startedAt, now))}</span>
      <span className="max-w-[88px] truncate text-fg-3">{timer.phase}</span>
    </Link>
  );
}

/** Shows the running time in the browser tab title. */
function TitleTicker({ data }: { data: AppData }) {
  const now = useNow();
  const timer = data.activeTimer!;
  const title = `${formatClock(elapsedSeconds(timer.startedAt, now))} · ${timer.phase} — PSP Workbench`;
  useEffect(() => {
    const previous = document.title;
    document.title = title;
    return () => {
      document.title = previous;
    };
  }, [title]);
  return null;
}

function IssueBanner({ message }: { message: string }) {
  return (
    <div role="status" className="mb-8 flex items-start gap-3 border-l-2 border-fg bg-surface py-3 pr-2 pl-4 text-body text-fg">
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={dismissIssue}
        aria-label="Dismiss notice"
        className="-my-1 grid size-9 shrink-0 place-items-center rounded-sm text-fg-3 hover:bg-hover hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-5">
      <div className="h-3 w-24 bg-surface" />
      <div className="h-7 w-64 bg-surface" />
      <div className="h-56 border-t border-hairline" />
    </div>
  );
}
