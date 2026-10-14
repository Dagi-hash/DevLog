"use client";

import { FolderClosed, PanelLeftClose, PanelLeftOpen, Pause, ScrollText, Settings2, Timer, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { workingSeconds } from "@/lib/domain/calculations";
import { formatClock } from "@/lib/domain/format";
import type { AppData } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { setSidebarCollapsed, useSidebarCollapsed } from "@/lib/state/uiPrefs";
import { dismissIssue, useStoreState } from "@/lib/state/store";
import { FocusProvider } from "./focus";
import { FocusSession } from "./FocusSession";
import { Monogram, Wordmark } from "./Logo";
import { RecordingDot, cx } from "./ui";

const PRIMARY_NAV = [
  { href: "/", label: "Today", icon: Timer },
  { href: "/projects", label: "Projects", icon: FolderClosed },
  { href: "/log", label: "Time log", icon: ScrollText },
] as const;

const SETTINGS = { href: "/settings", label: "Settings", icon: Settings2 } as const;

type NavItem = { href: string; label: string; icon: typeof Timer };

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** "12:04" under an hour, "1:12:04" beyond. */
function compactClock(seconds: number) {
  const full = formatClock(seconds);
  return seconds < 3600 ? full.slice(3) : full.replace(/^0/, "");
}

export function AppShell({ children }: { children: ReactNode }) {
  const state = useStoreState();
  const pathname = usePathname();
  const collapsed = useSidebarCollapsed();

  // The focus view opens when a session starts, and on load if a session is
  // already running and the app opens on Today. Minimizing keeps the timer running.
  const [initialPath] = useState(pathname);
  const [focusPref, setFocusPref] = useState<boolean | null>(null);
  const timerData = state?.data.activeTimer ? state.data : null;
  const focusOpen = timerData !== null && (focusPref ?? initialPath === "/");
  const openFocus = useCallback(() => setFocusPref(true), []);
  const minimizeFocus = useCallback(() => setFocusPref(false), []);
  const focus = useMemo(
    () => ({ isOpen: focusOpen, open: openFocus, minimize: minimizeFocus }),
    [focusOpen, openFocus, minimizeFocus],
  );

  const shellStyle = {
    "--sidebar-w": collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-expanded)",
  } as CSSProperties;

  return (
    <FocusProvider value={focus}>
      <div className="min-h-dvh" style={shellStyle}>
        {/* Desktop: collapsible sidebar */}
        <aside
          className="fixed inset-y-0 left-0 z-20 hidden w-[var(--sidebar-w)] flex-col overflow-hidden border-r border-hairline bg-canvas py-4 transition-[width] duration-300 ease-out-soft md:flex"
          aria-label="Sidebar"
        >
          <Link
            href="/"
            className={cx("mb-6 flex h-11 items-center rounded-sm", collapsed ? "mx-auto justify-center px-2" : "mx-3 px-3")}
            aria-label="DevLog — Today"
          >
            {collapsed ? <Monogram /> : <Wordmark />}
          </Link>

          <nav aria-label="Main" className="flex flex-col gap-0.5 px-2.5">
            {PRIMARY_NAV.map((item) => (
              <SidebarLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={collapsed} />
            ))}
          </nav>

          <div className="mt-auto flex flex-col gap-0.5 px-2.5">
            {timerData && !focusOpen && <SidebarSession data={timerData} collapsed={collapsed} onOpen={openFocus} />}
            <SidebarLink item={SETTINGS} active={isActive(pathname, SETTINGS.href)} collapsed={collapsed} />
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!collapsed)}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : undefined}
              className="flex h-10 items-center gap-3 rounded-md px-[15px] text-fg-3 transition-colors hover:bg-hover hover:text-fg-2"
            >
              {collapsed ? (
                <PanelLeftOpen className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden />
              ) : (
                <PanelLeftClose className="size-[18px] shrink-0" strokeWidth={1.7} aria-hidden />
              )}
              <span className={cx("text-body whitespace-nowrap transition-opacity duration-200", collapsed && "opacity-0")}>
                Collapse
              </span>
            </button>
          </div>
        </aside>

        {/* Mobile: quiet top bar */}
        <header className="sticky top-0 z-20 bg-canvas/85 pt-[var(--safe-top)] backdrop-blur-md md:hidden">
          <div className="flex h-[var(--mobile-bar-height)] items-center justify-between pr-1.5 pl-5">
            <Link href="/" className="flex h-11 items-center" aria-label="DevLog — Today">
              <Wordmark className="text-[22px]" />
            </Link>
            <Link
              href={SETTINGS.href}
              aria-label="Settings"
              aria-current={isActive(pathname, SETTINGS.href) ? "page" : undefined}
              className={cx(
                "grid size-11 place-items-center rounded-full transition-colors",
                isActive(pathname, SETTINGS.href) ? "text-fg" : "text-fg-3 hover:text-fg",
              )}
            >
              <Settings2 className="size-5" strokeWidth={1.7} />
            </Link>
          </div>
        </header>

        <main className="transition-[padding] duration-300 ease-out-soft md:pl-[var(--sidebar-w)]">
          <div className="mx-auto w-full max-w-[1080px] px-5 pt-4 pb-[calc(var(--mobile-nav-height)+var(--mobile-nav-gap)+var(--safe-bottom)+40px)] md:px-12 md:pt-14 md:pb-24">
            {state?.issue && <IssueBanner message={state.issue} />}
            {state ? (
              <div key={pathname} className="animate-page-in">
                {children}
              </div>
            ) : (
              <LoadingState />
            )}
          </div>
        </main>

        {/* Mobile: floating capsule navigation */}
        <nav
          aria-label="Main"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--safe-bottom)+var(--mobile-nav-gap))] z-30 flex justify-center px-4 md:hidden"
        >
          <div className="pointer-events-auto flex h-[var(--mobile-nav-height)] items-center gap-1 rounded-full border border-border bg-surface/90 p-1.5 shadow-[0_16px_48px_rgb(0_0_0/0.55)] backdrop-blur-md">
            {timerData && !focusOpen && <CapsuleSession data={timerData} onOpen={openFocus} />}
            {PRIMARY_NAV.map((item) => (
              <CapsuleLink key={item.href} item={item} active={isActive(pathname, item.href)} />
            ))}
          </div>
        </nav>

        {state && <FocusSession data={state.data} open={focusOpen} onMinimize={minimizeFocus} />}
        {timerData && <TitleTicker data={timerData} />}
      </div>
    </FocusProvider>
  );
}

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={cx(
        "flex h-10 items-center gap-3 rounded-md px-[15px] transition-colors duration-150",
        active ? "bg-surface text-fg" : "text-fg-3 hover:bg-hover hover:text-fg-2",
      )}
    >
      <Icon className="size-[18px] shrink-0" strokeWidth={active ? 2 : 1.7} aria-hidden />
      <span className={cx("text-body whitespace-nowrap", collapsed && "sr-only")}>{item.label}</span>
    </Link>
  );
}

function SidebarSession({ data, collapsed, onOpen }: { data: AppData; collapsed: boolean; onOpen: () => void }) {
  const now = useNow();
  const timer = data.activeTimer!;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Return to focus session: ${timer.phase}${timer.pausedAt ? " (paused)" : ""}`}
      className={cx(
        "mb-2 flex h-11 items-center gap-2.5 rounded-md border border-border text-left transition-colors hover:border-border-strong",
        collapsed ? "flex-col justify-center gap-1 px-0 py-1.5 h-auto" : "px-[15px]",
      )}
    >
      {timer.pausedAt ? <Pause className="size-3 text-fg-2" aria-hidden /> : <RecordingDot className="size-1.5" />}
      <span className={cx("num", timer.pausedAt ? "text-fg-2" : "text-fg", collapsed ? "text-tiny" : "text-meta")}>
        {compactClock(workingSeconds(timer, now))}
      </span>
      {!collapsed && <span className="truncate text-meta text-fg-3">{timer.phase}</span>}
    </button>
  );
}

function CapsuleLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "flex h-full items-center rounded-full transition-all duration-300 ease-out-soft",
        active ? "gap-2 bg-elevated pr-4 pl-3.5 text-fg" : "gap-0 px-3.5 text-fg-3 active:bg-press",
      )}
    >
      <Icon className="size-5 shrink-0" strokeWidth={active ? 2 : 1.7} aria-hidden />
      <span
        className={cx(
          "overflow-hidden text-meta font-medium whitespace-nowrap transition-[max-width,opacity] duration-300 ease-out-soft",
          active ? "max-w-24 opacity-100" : "max-w-0 opacity-0",
        )}
      >
        {item.label}
      </span>
    </Link>
  );
}

function CapsuleSession({ data, onOpen }: { data: AppData; onOpen: () => void }) {
  const now = useNow();
  const timer = data.activeTimer!;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Return to focus session: ${timer.phase}${timer.pausedAt ? " (paused)" : ""}`}
      className="mr-1 flex h-full items-center gap-2 rounded-full bg-inverse pr-4 pl-3.5 text-inverse-fg transition-transform active:scale-[0.97]"
    >
      {timer.pausedAt ? (
        <Pause className="size-3 fill-current" aria-hidden />
      ) : (
        <span aria-hidden className="size-1.5 animate-pulse-dot rounded-full bg-inverse-fg" />
      )}
      <span className="num text-meta font-medium">{compactClock(workingSeconds(timer, now))}</span>
    </button>
  );
}

/** Shows the running time in the browser tab title. */
function TitleTicker({ data }: { data: AppData }) {
  const now = useNow();
  const timer = data.activeTimer!;
  const seconds = workingSeconds(timer, now);
  const over = timer.targetMinutes !== null && seconds > timer.targetMinutes * 60;
  const state = timer.pausedAt ? "Paused · " : "";
  const title = `${state}${formatClock(seconds)}${over ? " · over" : ""} · ${timer.phase} — DevLog`;
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
    </div>
  );
}
