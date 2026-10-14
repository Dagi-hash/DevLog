"use client";

import { Play, Square } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
import { Button, Field, InlineAlert, ModeTag, Segmented, Select, TextInput, cx } from "./ui";

export function TimerPanel({
  data,
  projectId,
  onProjectChange,
}: {
  data: AppData;
  /** Project selected for the next timer (lifted so the page can summarise it). */
  projectId: string | null;
  onProjectChange: (projectId: string) => void;
}) {
  return data.activeTimer ? <RunningTimer data={data} /> : (
    <StartForm data={data} projectId={projectId} onProjectChange={onProjectChange} />
  );
}

// ---------------------------------------------------------------------------
// Idle: choose what to work on
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
      <div className="rounded-lg border border-line bg-surface px-5 py-8 text-center sm:px-8">
        <p className="text-[15px] font-medium text-fg">No active projects</p>
        <p className="mt-1 text-[14px] text-fg-2">
          Completed and archived projects can’t be timed. Reopen one or create a new project.
        </p>
        <Link href="/projects" className="mt-4 inline-block text-[14px] font-medium text-accent hover:text-accent-strong">
          Go to projects
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        start();
      }}
      className="rounded-lg border border-line bg-surface"
      aria-label="Start a timer"
    >
      <div className="space-y-5 px-4 pt-5 pb-5 sm:px-6">
        <Field label="Project" htmlFor="start-project">
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
        </Field>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-fg-2">Phase</legend>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {PHASES.map((p) => {
              const row = summary?.rows.find((r) => r.phase === p);
              const selected = p === phase;
              return (
                <label
                  key={p}
                  className={cx(
                    "flex min-h-12 cursor-pointer flex-col justify-center rounded-md border px-3 py-1.5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                    selected
                      ? "border-accent/60 bg-accent-soft"
                      : "border-line bg-bg/40 hover:border-line-strong hover:bg-white/[0.02]",
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
                  <span className={cx("truncate text-[13.5px] font-medium", selected ? "text-fg" : "text-fg-2")}>{p}</span>
                  {row && (
                    <span className="num truncate text-[11.5px] text-fg-3">
                      {formatMinutes(row.actual)} / {formatMinutes(row.revised ?? row.original)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div>
          <p id="start-mode-label" className="mb-1.5 text-[13px] font-medium text-fg-2">
            Work mode
          </p>
          <Segmented
            label="Work mode"
            name="start-mode"
            value={workMode}
            onChange={setWorkMode}
            className="flex w-full"
            options={WORK_MODES.map((m) => ({ value: m, label: WORK_MODE_INFO[m].label }))}
          />
          <p className="mt-2 text-[12.5px] leading-snug text-fg-3">{WORK_MODE_INFO[workMode].description}</p>
        </div>

        <Field label="What are you working on?" htmlFor="start-description" hint="Optional">
          <TextInput
            id="start-description"
            value={description}
            maxLength={500}
            autoComplete="off"
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        {error && <InlineAlert>{error}</InlineAlert>}
      </div>
      <div className="border-t border-line px-4 py-4 sm:px-6">
        <Button type="submit" variant="primary" size="lg" className="w-full sm:w-auto">
          <Play className="fill-current" />
          Start timer
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Running: the elapsed time is the focal point
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
    <section aria-label="Running timer" className="rounded-lg border border-line bg-surface">
      <div className="px-5 pt-5 pb-6 sm:px-8 sm:pt-7 sm:pb-8">
        <div className="flex items-center gap-2 text-[12.5px] font-medium tracking-wide text-under uppercase">
          <span className="size-2 animate-pulse-dot rounded-full bg-under" aria-hidden />
          Recording
        </div>

        <p
          className="num mt-4 font-mono text-[56px] leading-none font-medium tracking-[-0.03em] text-fg sm:text-[84px]"
          role="timer"
          aria-label={`Elapsed ${formatClock(seconds)}`}
          data-testid="elapsed"
        >
          {formatClock(seconds)}
        </p>

        <div className="mt-5 space-y-1.5">
          <p className="truncate text-[17px] font-semibold tracking-tight text-fg">
            {project ? (
              <Link href={`/projects/${project.id}`} className="hover:underline hover:decoration-fg-3 hover:underline-offset-4">
                {project.name}
              </Link>
            ) : (
              "Unknown project"
            )}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-fg-2">
            <span className="font-medium text-fg">{timer.phase}</span>
            <ModeTag mode={timer.workMode} />
            <span className="num text-fg-3">Started {formatTime(timer.startedAt)}</span>
          </div>
          {timer.description && <p className="pt-1 text-[14px] break-words text-fg-2">{timer.description}</p>}
          {row && (
            <p className="num pt-1 text-[13px] text-fg-3">
              {timer.phase} so far: {formatMinutes(row.actual)} saved of {formatMinutes(plan)}{" "}
              {row.revised !== null ? "revised plan" : "planned"}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:px-8">
        <Button variant="ghost" onClick={() => setConfirmDiscard(true)} className="sm:mr-auto">
          Discard
        </Button>
        <Button variant="primary" size="lg" onClick={() => setStoppedAt(Date.now())} className="w-full sm:w-auto sm:min-w-40">
          <Square className="size-3.5! fill-current" />
          Stop
        </Button>
      </div>

      <StopTimerDialog
        timer={stoppedAt !== null ? timer : null}
        projectName={project?.name ?? "Unknown project"}
        endedAtMs={stoppedAt ?? 0}
        onKeepRunning={() => setStoppedAt(null)}
        onDone={() => setStoppedAt(null)}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this timer?"
        description={`The ${formatClock(seconds)} recorded for ${timer.phase} will not be saved. This can’t be undone.`}
        confirmLabel="Discard timer"
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          const result = run((d) => discardTimer(d, timer.sessionId));
          return result.ok ? undefined : result.error;
        }}
      />
    </section>
  );
}
