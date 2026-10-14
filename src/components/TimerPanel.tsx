"use client";

import { ArrowRight, Maximize2, Play } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { buildProjectSummary, elapsedSeconds } from "@/lib/domain/calculations";
import { formatClock, formatMinutes } from "@/lib/domain/format";
import { PHASES, WORK_MODES, WORK_MODE_INFO, type Phase, type WorkMode } from "@/lib/domain/psp";
import type { AppData } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { startTimer } from "@/lib/state/actions";
import { loadPrefs, savePrefs } from "@/lib/state/prefs";
import { run } from "@/lib/state/store";
import { useFocus } from "./focus";
import { Button, InlineAlert, ModeGlyph, RecordingDot, Segmented, Select, TextInput, cx } from "./ui";

/** The Today surface: compose the next session, or return to the one in progress. */
export function TimerPanel({
  data,
  projectId,
  onProjectChange,
}: {
  data: AppData;
  projectId: string | null;
  onProjectChange: (projectId: string) => void;
}) {
  return data.activeTimer ? (
    <SessionInProgress data={data} />
  ) : (
    <Composer data={data} projectId={projectId} onProjectChange={onProjectChange} />
  );
}

function Label({ htmlFor, children }: { htmlFor?: string; children: ReactNode }) {
  return htmlFor ? (
    <label htmlFor={htmlFor} className="mb-2.5 block text-meta text-fg-3">
      {children}
    </label>
  ) : (
    <p className="mb-2.5 text-meta text-fg-3" aria-hidden>
      {children}
    </p>
  );
}

function Composer({
  data,
  projectId,
  onProjectChange,
}: {
  data: AppData;
  projectId: string | null;
  onProjectChange: (projectId: string) => void;
}) {
  const focus = useFocus();
  const [prefs] = useState(loadPrefs);
  const [phase, setPhase] = useState<Phase>(prefs.phase);
  const [workMode, setWorkMode] = useState<WorkMode>(prefs.workMode);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const activeProjects = data.projects.filter((p) => p.status === "active");
  const project = activeProjects.find((p) => p.id === projectId) ?? null;
  const row = project ? buildProjectSummary(project.id, data.estimates, data.entries).rows.find((r) => r.phase === phase) : null;

  function start() {
    if (!project) {
      setError("Choose an active project first.");
      return;
    }
    const result = run((d) => startTimer(d, { projectId: project.id, phase, workMode, description }, new Date().toISOString()));
    if (!result.ok) {
      setError(result.error);
      return;
    }
    savePrefs({ projectId: project.id, phase, workMode });
    focus.open();
  }

  if (activeProjects.length === 0) {
    return (
      <div className="py-6">
        <p className="text-lead text-fg">No active projects</p>
        <p className="mt-1.5 text-body text-fg-2">Completed and archived projects can’t be timed.</p>
        <Link href="/projects" className="mt-4 inline-flex h-11 items-center gap-2 text-body text-fg underline underline-offset-4">
          Go to projects <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <form
      noValidate
      aria-label="Start a session"
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        start();
      }}
    >
      <div>
        <Label htmlFor="start-project">Project</Label>
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
      </div>

      <fieldset>
        <legend className="mb-2.5 text-meta text-fg-3">Phase</legend>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {PHASES.map((p) => {
            const selected = p === phase;
            return (
              <label
                key={p}
                className={cx(
                  "flex h-12 cursor-pointer items-center rounded-md px-3.5 text-body transition-colors duration-200 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-fg sm:h-11",
                  selected ? "bg-inverse font-medium text-inverse-fg" : "bg-surface text-fg-2 hover:bg-elevated hover:text-fg",
                )}
              >
                <input type="radio" name="start-phase" value={p} checked={selected} onChange={() => setPhase(p)} className="sr-only" />
                <span className="truncate">{p}</span>
              </label>
            );
          })}
        </div>
        {row && (
          <p className="num mt-3 text-meta text-fg-3" aria-live="polite">
            <span className="font-mono text-fg-2">{formatMinutes(row.actual)}</span> recorded of{" "}
            <span className="font-mono text-fg-2">{formatMinutes(row.revised ?? row.original)}</span>{" "}
            {row.revised !== null ? "revised" : "planned"}
          </p>
        )}
      </fieldset>

      <div>
        <Label>Work mode</Label>
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
        <p className="mt-3 text-meta leading-relaxed text-fg-3">{WORK_MODE_INFO[workMode].description}</p>
      </div>

      <div>
        <Label htmlFor="start-description">Note</Label>
        <TextInput
          id="start-description"
          value={description}
          maxLength={500}
          autoComplete="off"
          placeholder="Optional"
          onChange={(event) => setDescription(event.target.value)}
        />
      </div>

      <div className="space-y-4 pt-2">
        {error && <InlineAlert>{error}</InlineAlert>}
        <Button type="submit" variant="primary" size="lg" className="h-14 w-full rounded-full sm:w-auto sm:min-w-56">
          <Play className="fill-current" aria-hidden />
          Start timer
        </Button>
      </div>
    </form>
  );
}

function SessionInProgress({ data }: { data: AppData }) {
  const focus = useFocus();
  const now = useNow();
  const timer = data.activeTimer!;
  const project = data.projects.find((p) => p.id === timer.projectId);
  return (
    <section aria-label="Session in progress" className="rounded-lg bg-surface px-6 py-7 sm:px-8">
      <p className="micro flex items-center gap-2.5 text-fg-2">
        <RecordingDot className="size-1.5" />
        In progress
      </p>
      <p className="num mt-4 font-mono text-[44px] leading-none font-light tracking-[-0.04em] text-fg">
        {formatClock(elapsedSeconds(timer.startedAt, now || Date.parse(timer.startedAt)))}
      </p>
      <p className="mt-4 text-body text-fg">{timer.phase}</p>
      <p className="mt-0.5 text-meta break-words text-fg-3">{project?.name}</p>
      <Button variant="primary" size="lg" onClick={focus.open} className="mt-7 h-12 w-full rounded-full sm:w-auto">
        <Maximize2 aria-hidden />
        Return to focus
      </Button>
    </section>
  );
}
