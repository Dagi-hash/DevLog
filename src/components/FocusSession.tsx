"use client";

import { ChevronDown, Square } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { elapsedSeconds } from "@/lib/domain/calculations";
import { formatClock, formatTime } from "@/lib/domain/format";
import { WORK_MODE_INFO } from "@/lib/domain/psp";
import type { ActiveTimer, AppData } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { StopTimerDialog } from "./StopTimerDialog";
import { Button, ModeGlyph, RecordingDot } from "./ui";

/**
 * The full-screen work session. The clock sits inside a dial of 60 second-ticks;
 * the current second is lit and the previous ones fade behind it, so time is
 * felt without demanding attention. Elapsed time is always now − start.
 */
export function FocusSession({ data, open, onMinimize }: { data: AppData; open: boolean; onMinimize: () => void }) {
  const timer = data.activeTimer;
  // Keep the last session on screen while the layer fades out after Save/Discard.
  const [shown, setShown] = useState<ActiveTimer | null>(timer);
  if (timer && timer !== shown) setShown(timer);
  const session = timer ?? shown;
  const isOpen = open && timer !== null;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("dialog[open]")) onMinimize();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onMinimize]);

  if (!session) return null;

  return (
    <div
      className="focus-layer fixed inset-0 z-40 flex flex-col bg-canvas"
      data-open={isOpen}
      inert={!isOpen}
      role="region"
      aria-label="Focus session"
    >
      <FocusContent data={data} session={session} active={isOpen} onMinimize={onMinimize} />
    </div>
  );
}

function FocusContent({
  data,
  session,
  active,
  onMinimize,
}: {
  data: AppData;
  session: ActiveTimer;
  active: boolean;
  onMinimize: () => void;
}) {
  const now = useNow();
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const project = data.projects.find((p) => p.id === session.projectId);
  const seconds = elapsedSeconds(session.startedAt, now || Date.parse(session.startedAt));
  const running = data.activeTimer?.sessionId === session.sessionId;

  return (
    <>
      <header className="flex items-center justify-between px-2 pt-[calc(var(--safe-top)+6px)] md:px-6 md:pt-5">
        <button
          type="button"
          onClick={onMinimize}
          className="inline-flex h-11 items-center gap-1.5 rounded-sm px-3 text-meta text-fg-2 transition-colors hover:bg-hover hover:text-fg"
        >
          <ChevronDown className="size-4" aria-hidden />
          Minimize
        </button>
        <p className="micro flex items-center gap-2 pr-4 text-fg-2">
          <RecordingDot className="size-1.5" />
          Recording
        </p>
      </header>

      <div className="focus-stage flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <Dial seconds={seconds} active={active}>
          <p
            role="timer"
            aria-label={`Elapsed ${formatClock(seconds)}`}
            data-testid="elapsed"
            className="num font-mono text-[44px] leading-none font-light tracking-[-0.045em] text-fg sm:text-[56px] md:text-[clamp(56px,8vh,88px)]"
          >
            {formatClock(seconds)}
          </p>
          <p className="num mt-3 font-mono text-meta text-fg-3">since {formatTime(session.startedAt)}</p>
        </Dial>

        <div className="mt-10 max-w-md text-center md:mt-12">
          <p className="text-lead text-fg">{session.phase}</p>
          <p className="mt-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-meta text-fg-3">
            <span className="break-words">{project?.name ?? "Unknown project"}</span>
            <span aria-hidden className="text-fg-4">·</span>
            <span className="inline-flex items-center gap-1.5">
              <ModeGlyph mode={session.workMode} />
              {WORK_MODE_INFO[session.workMode].label}
            </span>
          </p>
          {session.description && <p className="mt-3 text-body break-words text-fg-2">{session.description}</p>}
        </div>
      </div>

      <div className="flex justify-center px-6 pt-4 pb-[calc(var(--safe-bottom)+28px)] md:pb-14">
        <Button
          variant="primary"
          size="lg"
          disabled={!running}
          onClick={() => setStoppedAt(Date.now())}
          className="h-14 w-full max-w-xs rounded-full"
        >
          <Square className="size-3.5! fill-current" aria-hidden />
          Stop
        </Button>
      </div>

      <StopTimerDialog
        timer={stoppedAt !== null && running ? session : null}
        projectName={project?.name ?? "Unknown project"}
        endedAtMs={stoppedAt ?? 0}
        onKeepRunning={() => setStoppedAt(null)}
        onDone={() => setStoppedAt(null)}
      />
    </>
  );
}

// Tick geometry is fixed; compute it once.
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const angle = ((i * 6 - 90) * Math.PI) / 180;
  const major = i % 5 === 0;
  const inner = major ? 85 : 89;
  const outer = 96;
  return {
    i,
    major,
    x1: 100 + inner * Math.cos(angle),
    y1: 100 + inner * Math.sin(angle),
    x2: 100 + outer * Math.cos(angle),
    y2: 100 + outer * Math.sin(angle),
  };
});

const TRAIL = 14;

function Dial({ seconds, active, children }: { seconds: number; active: boolean; children: ReactNode }) {
  const current = seconds % 60;
  return (
    <div className="relative grid aspect-square w-[min(82vw,340px)] place-items-center md:w-[min(56vh,460px)]">
      <svg viewBox="0 0 200 200" aria-hidden className="absolute inset-0 size-full text-fg">
        {TICKS.map((t) => {
          const age = (current - t.i + 60) % 60;
          const lit = active && age < TRAIL;
          const opacity = lit ? 1 - (age / TRAIL) * 0.85 : t.major ? 0.22 : 0.1;
          return (
            <line
              key={t.i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke="currentColor"
              strokeWidth={t.major ? 1.4 : 1}
              strokeLinecap="round"
              opacity={opacity}
              className="focus-tick"
            />
          );
        })}
      </svg>
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  );
}
