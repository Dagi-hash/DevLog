"use client";

import { ArrowRight, FolderClosed, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildProjectSummary, sumNetMinutes, variancePercent } from "@/lib/domain/calculations";
import {
  formatLongDate,
  formatMinutes,
  formatPercentVariance,
  formatSignedMinutes,
  formatTime,
  isSameLocalDay,
} from "@/lib/domain/format";
import type { AppData, Project } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { loadPrefs } from "@/lib/state/prefs";
import { useAppData } from "@/lib/state/store";
import { EmptyState } from "../EmptyState";
import { ProjectForm } from "../ProjectForm";
import { TimerPanel } from "../TimerPanel";
import { Button, ModeDot, ProgressBar, SectionHeading, StatusPill, cx } from "../ui";
import { useEntryDialogs } from "../useEntryDialogs";

export function TodayPage() {
  const data = useAppData();
  const now = new Date(useNow());
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => loadPrefs().projectId);
  const { openEdit, dialogs } = useEntryDialogs(data);

  const activeProjects = data.projects.filter((p) => p.status === "active");
  const selected = activeProjects.find((p) => p.id === selectedId) ?? mostRecentlyUsed(data, activeProjects) ?? null;
  const focusProject = data.activeTimer
    ? data.projects.find((p) => p.id === data.activeTimer!.projectId) ?? null
    : selected;

  if (data.projects.length === 0) {
    return (
      <>
        <PageDate now={now} />
        <div className="mt-8 rounded-lg border border-line bg-surface">
          <EmptyState
            icon={<FolderClosed />}
            title="Start with a project"
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus />
                Create your first project
              </Button>
            }
          >
            A project holds your phase estimates and every minute you record against them. Plan it, then start the timer.
          </EmptyState>
        </div>
        <ProjectForm
          open={creating}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/projects/${id}`)}
        />
      </>
    );
  }

  const todays = data.entries
    .filter((e) => isSameLocalDay(e.startedAt, now))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <>
      <PageDate now={now} />
      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0">
          <TimerPanel data={data} projectId={selected?.id ?? null} onProjectChange={setSelectedId} />
        </div>

        <div className="min-w-0 space-y-8">
          <section aria-labelledby="today-heading">
            <SectionHeading
              id="today-heading"
              title="Recorded today"
              aside={<span className="num text-[13px] font-medium text-fg">{formatMinutes(sumNetMinutes(todays))}</span>}
            />
            {todays.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13.5px] text-fg-3">
                Nothing recorded yet today.
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
                {todays.map((entry) => {
                  const project = data.projects.find((p) => p.id === entry.projectId);
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="grid w-full grid-cols-[1fr_auto] gap-x-3 px-4 py-2.5 text-left transition-colors hover:bg-white/[0.02]"
                        aria-label={`Edit ${entry.phase} entry, ${formatMinutes(entry.netMinutes)}`}
                      >
                        <span className="flex min-w-0 items-center gap-2 text-[13.5px]">
                          <ModeDot mode={entry.workMode} />
                          <span className="font-medium whitespace-nowrap text-fg">{entry.phase}</span>
                          <span className="min-w-0 truncate text-fg-3">{project?.name}</span>
                        </span>
                        <span className="num text-[13.5px] font-semibold text-fg">{formatMinutes(entry.netMinutes)}</span>
                        <span className="num pl-3.5 font-mono text-[11.5px] text-fg-3">
                          {formatTime(entry.startedAt)}–{formatTime(entry.endedAt)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link
              href="/log"
              className="mt-2.5 inline-flex items-center gap-1.5 px-1 text-[13px] text-fg-2 transition-colors hover:text-fg"
            >
              Full time log <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>

          {focusProject && <ProjectGlance project={focusProject} data={data} />}
        </div>
      </div>
      {dialogs}
    </>
  );
}

function PageDate({ now }: { now: Date }) {
  return (
    <header>
      <p className="text-[12.5px] font-medium tracking-wide text-fg-3 uppercase">Today</p>
      <h1 className="mt-1 text-[24px] font-semibold tracking-tight text-fg sm:text-[28px]" suppressHydrationWarning>
        {formatLongDate(now)}
      </h1>
    </header>
  );
}

function mostRecentlyUsed(data: AppData, candidates: Project[]): Project | undefined {
  const ids = new Set(candidates.map((p) => p.id));
  const latest = [...data.entries]
    .filter((e) => ids.has(e.projectId))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0];
  return candidates.find((p) => p.id === latest?.projectId) ?? candidates[0];
}

function ProjectGlance({ project, data }: { project: Project; data: AppData }) {
  const { totals } = buildProjectSummary(project.id, data.estimates, data.entries);
  const diff = totals.actual - totals.original;
  const pct = variancePercent(totals.actual, totals.original);
  const progress = totals.original > 0 ? Math.round((totals.actual / totals.original) * 100) : null;

  return (
    <section aria-labelledby="glance-heading">
      <SectionHeading id="glance-heading" title={data.activeTimer ? "Current project" : "Selected project"} />
      <div className="rounded-lg border border-line bg-surface px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/projects/${project.id}`}
            className="min-w-0 text-[15px] leading-snug font-semibold break-words text-fg hover:underline hover:decoration-fg-3 hover:underline-offset-4"
          >
            {project.name}
          </Link>
          <StatusPill status={project.status} />
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-3">
          <Stat label="Actual" value={formatMinutes(totals.actual)} strong />
          <Stat label="Planned" value={formatMinutes(totals.original)} />
          <Stat label="Forecast" value={totals.revised === null ? "—" : formatMinutes(totals.revised)} />
        </dl>

        <ProgressBar
          className="mt-4"
          actual={totals.actual}
          planned={totals.original}
          label={`${formatMinutes(totals.actual)} recorded of ${formatMinutes(totals.original)} planned`}
        />
        <p className="num mt-2 flex justify-between gap-3 text-[12.5px] text-fg-3">
          <span>{progress === null ? "No original plan yet" : `${progress}% of original plan used`}</span>
          <span className={cx(diff > 0 ? "text-over" : "text-fg-2")}>
            {formatSignedMinutes(diff)} min · {formatPercentVariance(pct)}
          </span>
        </p>
      </div>
    </section>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-fg-3">{label}</dt>
      <dd className={cx("num mt-0.5 truncate text-[15px]", strong ? "font-semibold text-fg" : "text-fg-2")}>{value}</dd>
    </div>
  );
}
