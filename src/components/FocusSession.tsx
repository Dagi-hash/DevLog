"use client";

import { ArrowRight, ChevronDown, Pause as PauseIcon, Play, Plus, Square } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { elapsedSeconds, grossMinutes, grossMinutesBetween, workingSeconds } from "@/lib/domain/calculations";
import { formatClock, formatMinutes, formatTime } from "@/lib/domain/format";
import { PHASES, WORK_MODE_INFO, type Phase } from "@/lib/domain/psp";
import type { ActiveTimer, AppData } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { createId, pauseTimer, pausedInterruption, resumeTimer, setTimerTarget, switchTimerPhase, undoPhaseSwitch } from "@/lib/state/actions";
import { run } from "@/lib/state/store";
import { Dialog } from "./Dialog";
import { StopTimerDialog } from "./StopTimerDialog";
import { Button, ModeGlyph, RecordingDot, cx } from "./ui";

/**
 * The full-screen work session. The clock sits inside a dial of 60 second-ticks;
 * the current second is lit and the previous ones fade behind it, so time is
 * felt without demanding attention. Worked time is always now − start − pauses.
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
  const [picking, setPicking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const project = data.projects.find((p) => p.id === session.projectId);
  const at = now || Date.parse(session.startedAt);
  const seconds = workingSeconds(session, at);
  const paused = session.pausedAt !== null;
  const running = data.activeTimer?.sessionId === session.sessionId;
  const target = session.targetMinutes;
  const remaining = target === null ? null : target * 60 - seconds;
  // Offer more time as the expected end approaches, and once it has passed.
  const canExtend = running && remaining !== null && remaining < 5 * 60;
  const next = PHASES[PHASES.indexOf(session.phase) + 1];

  // Notices fade on their own.
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(id);
  }, [notice]);

  const togglePause = useCallback(() => {
    if (!running) return;
    const nowIso = new Date().toISOString();
    run((d) => (paused ? resumeTimer(d, session.sessionId, nowIso) : pauseTimer(d, session.sessionId, nowIso)));
  }, [paused, running, session.sessionId]);

  // Space pauses and resumes while nothing else has focus.
  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== " " || event.target !== document.body || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      togglePause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, togglePause]);

  function extend() {
    if (target !== null) run((d) => setTimerTarget(d, session.sessionId, target + 15));
  }

  function switchTo(phase: Phase) {
    setPicking(false);
    const before = data;
    const nowIso = new Date().toISOString();
    const newSessionId = createId();
    const gross = grossMinutesBetween(session.startedAt, nowIso);
    const recorded = gross - pausedInterruption(session, nowIso);
    const result = run((d) =>
      switchTimerPhase(d, { sessionId: session.sessionId, phase, at: nowIso }, nowIso, createId(), newSessionId),
    );
    if (!result.ok) {
      setNotice({ text: result.error });
      return;
    }
    setNotice(
      gross > 0
        ? {
            text: `Saved ${formatMinutes(recorded)} of ${session.phase}. Now timing ${phase}.`,
            undo: () => {
              const undone = run((d) => undoPhaseSwitch(d, before, newSessionId));
              setNotice(undone.ok ? null : { text: undone.error });
            },
          }
        : { text: `Now timing ${phase}.` },
    );
  }

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
          {paused ? <PauseIcon className="size-3" aria-hidden /> : <RecordingDot className="size-1.5" />}
          {paused ? "Paused" : "Recording"}
        </p>
      </header>

      <div className="focus-stage flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <Dial seconds={seconds} active={active && !paused} targetSeconds={target === null ? null : target * 60}>
          <p
            role="timer"
            aria-label={`Elapsed ${formatClock(seconds)}${paused ? ", paused" : ""}`}
            data-testid="elapsed"
            className={cx(
              "num font-serif text-[52px] leading-none font-light tracking-[-0.02em] transition-colors duration-300 sm:text-[64px] md:text-[clamp(64px,10vh,104px)]",
              paused ? "text-fg-3" : "text-fg",
            )}
          >
            {formatClock(seconds)}
          </p>
          <p className="num mt-3 text-meta text-fg-3" data-testid="session-since">
            {paused
              ? `Paused for ${formatClock(elapsedSeconds(session.pausedAt!, at)).replace(/^00:/, "")}`
              : `since ${formatTime(session.startedAt)}`}
          </p>
          {remaining !== null && (
            <TargetStatus remaining={remaining} target={target!} endsAtMs={at + remaining * 1000} />
          )}
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
          {running && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-1">
              {next && (
                <Button size="sm" onClick={() => switchTo(next)} className="rounded-full">
                  Next: {next}
                  <ArrowRight aria-hidden />
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setPicking(true)} className="rounded-full">
                Switch phase…
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="flex min-h-11 items-center justify-center px-6">
        {notice && (
          <p role="status" className="flex animate-fade-in items-center gap-3 text-meta text-fg-2">
            <span>{notice.text}</span>
            {notice.undo && (
              <button
                type="button"
                onClick={notice.undo}
                className="-my-2 h-9 rounded-sm px-2 font-medium text-fg underline underline-offset-4 hover:bg-hover"
              >
                Undo
              </button>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 px-6 pt-2 pb-[calc(var(--safe-bottom)+28px)] md:pb-14">
        {canExtend && (
          <Button size="lg" onClick={extend} className="h-14 rounded-full px-5" aria-label="Add 15 minutes">
            <Plus aria-hidden />
            15 min
          </Button>
        )}
        <Button
          size="lg"
          variant={paused ? "primary" : "secondary"}
          disabled={!running}
          onClick={togglePause}
          className="h-14 rounded-full px-6"
        >
          {paused ? <Play className="fill-current" aria-hidden /> : <PauseIcon className="fill-current" aria-hidden />}
          {paused ? "Resume" : "Pause"}
        </Button>
        <Button
          variant={paused ? "secondary" : "primary"}
          size="lg"
          disabled={!running}
          onClick={() => setStoppedAt(Date.now())}
          className="h-14 min-w-0 flex-1 rounded-full sm:max-w-xs"
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

      <Dialog
        open={picking}
        onClose={() => setPicking(false)}
        title="Switch phase"
        description={
          grossMinutes(seconds) > 0
            ? `Saves ${formatMinutes(grossMinutes(seconds))} of ${session.phase}, then times the phase you pick.`
            : `Nothing recorded yet, so this just relabels the session.`
        }
        footer={<Button onClick={() => setPicking(false)}>Cancel</Button>}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {PHASES.filter((p) => p !== session.phase).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => switchTo(p)}
              className="flex h-12 items-center justify-between gap-2 rounded-md bg-canvas px-3.5 text-left text-body text-fg transition-colors hover:bg-elevated"
            >
              <span className="truncate">{p}</span>
              {p === next && <span className="micro shrink-0">Next</span>}
            </button>
          ))}
        </div>
      </Dialog>
    </>
  );
}

interface Notice {
  text: string;
  undo?: () => void;
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

/** "12 min left · done 5:45 PM", or "8 min over" once the expected length has passed. */
function TargetStatus({ remaining, target, endsAtMs }: { remaining: number; target: number; endsAtMs: number }) {
  const end = formatTime(new Date(endsAtMs).toISOString());
  const minutes = Math.ceil(Math.abs(remaining) / 60);
  return (
    <p className="num mt-1 text-meta text-fg-2" data-testid="target-status">
      {remaining >= 0 ? (
        <>
          {formatMinutes(Math.max(1, minutes))} left · done {end}
        </>
      ) : (
        <span className="text-fg">{formatMinutes(Math.max(1, Math.floor(-remaining / 60)))} over the {formatMinutes(target)} you planned</span>
      )}
    </p>
  );
}

function Dial({
  seconds,
  active,
  targetSeconds,
  children,
}: {
  seconds: number;
  active: boolean;
  /** Expected length; drawn as a thin outer ring that fills up. */
  targetSeconds: number | null;
  children: ReactNode;
}) {
  const current = seconds % 60;
  const progress = targetSeconds ? Math.min(1, seconds / targetSeconds) : 0;
  return (
    <div className="relative grid aspect-square w-[min(82vw,340px)] place-items-center md:w-[min(56vh,460px)]">
      <svg viewBox="0 0 200 200" aria-hidden className="absolute inset-0 size-full text-fg">
        {targetSeconds !== null && (
          <g transform="rotate(-90 100 100)">
            <circle cx="100" cy="100" r="99" fill="none" stroke="currentColor" strokeWidth="0.8" opacity={0.12} />
            <circle
              cx="100"
              cy="100"
              r="99"
              fill="none"
              stroke="currentColor"
              strokeWidth={progress >= 1 ? 1.6 : 0.8}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${progress * 100} 100`}
              className="transition-[stroke-dasharray] duration-1000 ease-linear"
            />
          </g>
        )}
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
