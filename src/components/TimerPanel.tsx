"use client";

import { ArrowRight, Play, Square } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { buildProjectSummary, elapsedSeconds } from "@/lib/domain/calculations";
import { formatClock, formatMinutes, formatTime } from "@/lib/domain/format";
import { PHASES, WORK_MODES, WORK_MODE_INFO, type Phase, type WorkMode } from "@/lib/domain/psp";
import type { AppData, Project } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { discardTimer, startTimer } from "@/lib/state/actions";
import { loadPrefs, savePrefs } from "@/lib/state/prefs";
import { run } from "@/lib/state/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { StopTimerDialog } from "./StopTimerDialog";
import { Button, InlineAlert, ModeGlyph, ModeTag, ProgressBar, RecordingDot, Segmented, Select, TextInput, cx } from "./ui";

export function TimerPanel({
  data,
  projectId,
  onProjectChange,
}: {
  data: AppData;
  /** Project selected for the next session (lifted so the page can summarise it). */
  projectId: string | null;
  onProjectChange: (projectId: string) => void;
}) {
  return data.activeTimer ? (
    <RunningTimer data={data} />
  ) : (
    <StartForm data={data} projectId={projectId} onProjectChange={onProjectChange} />
  );
}

/** Label column on desktop, stacked label on phones. */
function FormRow({ label, htmlFor, children }: { label?: string; htmlFor?: string; children: ReactNode }) {
  const labelClass = "text-meta text-fg-2 lg:micro lg:pt-3";
  return (
    <div className="grid gap-2.5 border-t border-hairline py-5 lg:grid-cols-[104px_minmax(0,1fr)] lg:gap-8 lg:py-6">
      {label ? (
        htmlFor ? (
          <label htmlFor={htmlFor} className={labelClass}>
            {label}
          </label>
        ) : (
          <p className={labelClass} aria-hidden>
            {label}
          </p>
        )
      ) : (
        <span className="hidden lg:block" />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Idle: compose the next session
// ---------------------------------------------------------------------------

function StartForm({
  data,
  projectId,
  onProjectChange,
}: {
  data: AppData;
  projectId: string | null;
  onProjectChange: (projectId: string) => void;
}) {
  const [prefs] = useState(loadPrefs);
  const [phase, setPhase] = useState<Phase>(prefs.phase);
  const [workMode, setWorkMode] = useState<WorkMode>(prefs.workMode);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeProjects = data.projects.filter((p) => p.status === "active");
  const project = activeProjects.find((p) => p.id === projectId) ?? null;
  const summary = project ? buildProjectSummary(project.id, data.estimates, data.entries) : null;

  function start() {
    if (!project) {
      setError("Choose an active project first.");
      return;
    }
    const result = run((d) =>
      startTimer(d, { projectId: project.id, phase, workMode, description }, new Date().toISOString()),
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    savePrefs({ projectId: project.id, phase, workMode });
    setDescription("");
    setError(null);
  }

  if (activeProjects.length === 0) {
    return (
      <div className="border-t border-hairline py-8">
        <p className="text-lead font-medium">No active projects</p>
        <p className="mt-1.5 text-body text-fg-2">
          Completed and archived projects can’t be timed. Reopen one or create a new project.
        </p>
        <Link href="/projects" className="mt-4 inline-flex h-11 items-center gap-2 text-body font-medium underline underline-offset-4">
          Go to projects <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      aria-label="Start a session"
      onSubmit={(event) => {
        event.preventDefault();
        start();
      }}
    >
      <FormRow label="Project" htmlFor="start-project">
        <Select
          id="start-project"
          value={project?.id ?? ""}
          onChange={(event) => {
            onProjectChange(event.target.value);
            setError(null);
          }}
        >
          {!project && <option value="">Choose a project…</option>}
          {activeProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </FormRow>

      <FormRow label="Phase">
        <fieldset>
          <legend className="sr-only">Phase</legend>
          <div className="grid grid-cols-2 gap-px border border-hairline bg-hairline">
            {PHASES.map((p) => {
              const row = summary?.rows.find((r) => r.phase === p);
              const selected = p === phase;
              return (
                <label
                  key={p}
                  className={cx(
                    "flex min-h-[54px] cursor-pointer flex-col justify-center gap-0.5 px-3.5 py-2 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-2 has-[:focus-visible]:outline-fg lg:min-h-11 lg:flex-row lg:items-center lg:justify-between lg:gap-3",
                    selected ? "bg-inverse text-inverse-fg" : "bg-canvas text-fg-2 hover:bg-surface hover:text-fg",
                  )}
                >
                  <input
                    type="radio"
                    name="start-phase"
                    value={p}
                    checked={selected}
                    onChange={() => setPhase(p)}
                    className="sr-only"
                  />
                  <span className={cx("truncate text-body", selected && "font-medium")}>{p}</span>
                  {row && (
                    <span className={cx("num shrink-0 font-mono text-tiny", selected ? "text-inverse-fg/70" : "text-fg-3")}>
                      {formatMinutes(row.actual)} / {formatMinutes(row.revised ?? row.original)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-meta text-fg-3">Recorded / planned for the selected project.</p>
        </fieldset>
      </FormRow>

      <FormRow label="Work mode">
        <Segmented
          label="Work mode"
          name="start-mode"
          value={workMode}
          onChange={setWorkMode}
          options={WORK_MODES.map((m) => ({
            value: m,
            label: (
              <>
                <ModeGlyph mode={m} />
                {WORK_MODE_INFO[m].label}
              </>
            ),
          }))}
        />
        <p className="mt-2.5 text-meta text-fg-3">{WORK_MODE_INFO[workMode].description}</p>
      </FormRow>

      <FormRow label="Note" htmlFor="start-description">
        <TextInput
          id="start-description"
          value={description}
          maxLength={500}
          autoComplete="off"
          placeholder="Optional — what are you working on?"
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormRow>

      <FormRow>
        {error && (
          <div className="mb-4">
            <InlineAlert>{error}</InlineAlert>
          </div>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full lg:w-auto lg:min-w-52">
          <Play className="fill-current" aria-hidden />
          Start timer
        </Button>
      </FormRow>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Running: the elapsed time is the anchor
// ---------------------------------------------------------------------------

function RunningTimer({ data }: { data: AppData }) {
  const timer = data.activeTimer!;
  const now = useNow();
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const project: Project | undefined = data.projects.find((p) => p.id === timer.projectId);
  const seconds = elapsedSeconds(timer.startedAt, now || Date.parse(timer.startedAt));
  const summary = buildProjectSummary(timer.projectId, data.estimates, data.entries);
  const row = summary.rows.find((r) => r.phase === timer.phase);
  const plan = row ? (row.revised ?? row.original) : 0;

  return (
    <section aria-label="Running timer" className="border-t border-hairline pt-6 lg:pt-8">
      <p className="micro flex items-center gap-2.5 text-fg">
        <RecordingDot className="size-1.5" />
        Recording
      </p>

      <p
        className="num mt-5 font-mono text-[64px] leading-[0.9] font-light tracking-[-0.04em] text-fg sm:text-[96px] lg:mt-6 lg:text-timer"
        role="timer"
        aria-label={`Elapsed ${formatClock(seconds)}`}
        data-testid="elapsed"
      >
        {formatClock(seconds)}
      </p>

      <div className="mt-7 space-y-1.5 lg:mt-9">
        <p className="text-lead font-medium break-words text-fg">
          {project ? (
            <Link href={`/projects/${project.id}`} className="underline-offset-4 hover:underline">
              {project.name}
            </Link>
          ) : (
            "Unknown project"
          )}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-fg-2">
          <span className="text-fg">{timer.phase}</span>
          <span aria-hidden className="text-fg-4">/</span>
          <ModeTag mode={timer.workMode} className="text-body" />
          <span aria-hidden className="text-fg-4">/</span>
          <span className="num font-mono text-meta text-fg-3">since {formatTime(timer.startedAt)}</span>
        </p>
        {timer.description && <p className="pt-1 text-body break-words text-fg-2">{timer.description}</p>}
      </div>

      <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 lg:mt-10">
        <Button variant="primary" size="lg" onClick={() => setStoppedAt(Date.now())} className="h-14 w-full sm:h-12 sm:w-auto sm:min-w-48">
          <Square className="size-3.5! fill-current" aria-hidden />
          Stop
        </Button>
        <Button variant="ghost" onClick={() => setConfirmDiscard(true)} className="h-12 sm:h-10">
          Discard session
        </Button>
      </div>

      {row && (
        <div className="mt-10 border-t border-hairline pt-4 lg:mt-14">
          <div className="mb-3 flex items-baseline justify-between gap-4 text-meta">
            <span className="text-fg-2">{timer.phase} — saved so far</span>
            <span className="num font-mono text-fg-2">
              {formatMinutes(row.actual)} <span className="text-fg-4">/</span> {formatMinutes(plan)}
              <span className="ml-1.5 text-fg-3">{row.revised !== null ? "revised" : "planned"}</span>
            </span>
          </div>
          <ProgressBar
            actual={row.actual}
            planned={plan}
            label={`${formatMinutes(row.actual)} saved of ${formatMinutes(plan)} for ${timer.phase}`}
          />
        </div>
      )}

      <StopTimerDialog
        timer={stoppedAt !== null ? timer : null}
        projectName={project?.name ?? "Unknown project"}
        endedAtMs={stoppedAt ?? 0}
        onKeepRunning={() => setStoppedAt(null)}
        onDone={() => setStoppedAt(null)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this session?"
        description={`${formatClock(seconds)} of ${timer.phase} will not be recorded. This can’t be undone.`}
        confirmLabel="Discard session"
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          const result = run((d) => discardTimer(d, timer.sessionId));
          return result.ok ? undefined : result.error;
        }}
      />
    </section>
  );
}
