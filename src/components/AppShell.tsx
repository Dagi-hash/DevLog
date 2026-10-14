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
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Today", icon: Timer },
  { href: "/projects", label: "Projects", icon: FolderClosed },
  { href: "/log", label: "Time log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const state = useStoreState();
  const pathname = usePathname();

  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[232px] flex-col border-r border-line bg-[#0b0d11] md:flex">
        <Brand className="px-5 pt-6 pb-7" />
        <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex h-9 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors duration-150",
                  active ? "bg-white/[0.06] text-fg" : "text-fg-2 hover:bg-white/[0.03] hover:text-fg",
                )}
              >
                <Icon className={cx("size-[17px]", active ? "text-accent" : "text-fg-3")} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-4 p-3">
          {state?.data.activeTimer && <SidebarTimer data={state.data} />}
          <p className="px-2 pb-2 text-[11.5px] leading-relaxed text-fg-3">
            Local prototype. Data is stored only in this browser and is not synced between devices.
          </p>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex h-[calc(52px+var(--safe-top))] items-end border-b border-line bg-bg/90 px-4 pt-[var(--safe-top)] pb-2.5 backdrop-blur-md md:hidden">
        <div className="flex w-full items-center justify-between gap-3">
          <Brand compact />
          {state?.data.activeTimer && pathname !== "/" && <MobileTimerPill data={state.data} />}
        </div>
      </header>

      <main className="md:pl-[232px]">
        <div className="mx-auto w-full max-w-[1160px] px-4 pt-5 pb-[calc(var(--mobile-nav-height)+var(--safe-bottom)+32px)] sm:px-6 md:px-10 md:pt-10 md:pb-16">
          {state?.issue && <IssueBanner message={state.issue} />}
          {state ? children : <LoadingState />}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-[#0b0d11]/95 pb-[var(--safe-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid h-[var(--mobile-nav-height)] grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-fg" : "text-fg-3",
                  )}
                >
                  <Icon className={cx("size-5", active && "text-accent")} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {state?.data.activeTimer && <TitleTicker data={state.data} />}
    </div>
  );
}

function Brand({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cx("flex items-center gap-2.5", className)} aria-label="PSP Workbench, go to Today">
      <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
        <rect x="1" y="1" width="22" height="22" rx="6" fill="#1a1f2a" stroke="rgb(255 255 255 / 0.12)" />
        <path d="M7 15.5V8.5h3.6a2.4 2.4 0 0 1 0 4.8H7" fill="none" stroke="#8198f5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14 15.5h3" stroke="#f2f3f5" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className={cx("font-semibold tracking-tight text-fg", compact ? "text-[15px]" : "text-[15px]")}>
        PSP Workbench
      </span>
    </Link>
  );
}

function SidebarTimer({ data }: { data: AppData }) {
  const now = useNow();
  const timer = data.activeTimer!;
  const project = data.projects.find((p) => p.id === timer.projectId);
  return (
    <Link
      href="/"
      className="block rounded-lg border border-line bg-surface px-3.5 py-3 transition-colors hover:border-line-strong"
    >
      <span className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-under uppercase">
        <span className="size-1.5 animate-pulse-dot rounded-full bg-under" aria-hidden />
        Recording
      </span>
      <span className="num mt-1.5 block font-mono text-[22px] leading-none font-medium text-fg">
        {formatClock(elapsedSeconds(timer.startedAt, now))}
      </span>
      <span className="mt-1.5 block truncate text-[12.5px] text-fg-2">
        {timer.phase} · {project?.name}
      </span>
    </Link>
  );
}

function MobileTimerPill({ data }: { data: AppData }) {
  const now = useNow();
  const timer = data.activeTimer!;
  return (
    <Link
      href="/"
      className="flex h-8 min-w-0 items-center gap-2 rounded-full border border-line-strong bg-surface pr-3 pl-2.5 text-[12.5px]"
      aria-label={`Timer running for ${timer.phase}. Open Today.`}
    >
      <span className="size-1.5 shrink-0 animate-pulse-dot rounded-full bg-under" aria-hidden />
      <span className="num font-mono font-medium text-fg">{formatClock(elapsedSeconds(timer.startedAt, now))}</span>
      <span className="truncate text-fg-2">{timer.phase}</span>
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
    <div role="status" className="mb-6 flex items-start gap-3 rounded-md border border-over/25 bg-over-soft px-4 py-3 text-[13.5px] text-over">
      <p className="flex-1 leading-snug">{message}</p>
      <button
        type="button"
        onClick={dismissIssue}
        aria-label="Dismiss notice"
        className="-m-1 grid size-7 shrink-0 place-items-center rounded-sm hover:bg-white/5"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function LoadingState() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <div className="h-6 w-48 rounded bg-white/[0.04]" />
      <div className="h-64 rounded-lg bg-white/[0.025]" />
    </div>
  );
}
