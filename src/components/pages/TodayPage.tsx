"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
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
import { Button, ModeGlyph, ProgressBar, SectionLabel, StatusLabel } from "../ui";
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
    ? (data.projects.find((p) => p.id === data.activeTimer!.projectId) ?? null)
    : selected;

  if (data.projects.length === 0) {
    return (
      <>
        <DateHeading now={now} />
        <div className="mt-10 max-w-xl">
          <EmptyState
            title="Start with a project"
            action={
              <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Create your first project
              </Button>
            }
          >
            A project holds your phase estimates and every minute you record against them.
          </EmptyState>
        </div>
        <ProjectForm open={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/projects/${id}`)} />
      </>
    );
  }

  const todays = data.entries
    .filter((e) => isSameLocalDay(e.startedAt, now))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const todayTotal = sumNetMinutes(todays);

  return (
    <>
      <div className="grid gap-x-16 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <DateHeading now={now} />
        </div>
        <div className="mt-5 flex items-baseline gap-3 lg:col-span-4 lg:col-start-9 lg:mt-0 lg:block">
          <p className="micro lg:mb-2">Recorded today</p>
          <p className="num font-mono text-[22px] leading-none text-fg lg:text-figure lg:font-light lg:tracking-[-0.03em]">
            {formatMinutes(todayTotal)}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-x-16 gap-y-12 lg:mt-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-7">
          <TimerPanel data={data} projectId={selected?.id ?? null} onProjectChange={setSelectedId} />
        </div>

        <aside className="min-w-0 space-y-12 lg:col-span-4 lg:col-start-9" aria-label="Today and project overview">
          <section aria-labelledby="ledger-heading">
            <SectionLabel id="ledger-heading" aside={<span className="num font-mono text-meta text-fg-3">{todays.length}</span>}>
              Today’s entries
            </SectionLabel>
            {todays.length === 0 ? (
              <p className="py-5 text-body text-fg-3">Nothing recorded yet today.</p>
            ) : (
              <ul>
                {todays.map((entry) => {
                  const project = data.projects.find((p) => p.id === entry.projectId);
                  return (
                    <li key={entry.id} className="border-b border-hairline">
                      <button
                        type="button"
                        onClick={() => openEdit(entry)}
                        className="grid min-h-14 w-full grid-cols-[64px_minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 text-left transition-colors hover:bg-hover"
                        aria-label={`Edit ${entry.phase} entry, ${formatMinutes(entry.netMinutes)}`}
                      >
                        <span className="num font-mono text-meta whitespace-nowrap text-fg-3">{formatTime(entry.startedAt)}</span>
                        <span className="min-w-0">
                          <span className="flex items-center gap-2 text-body text-fg">
                            <ModeGlyph mode={entry.workMode} className="text-fg-2" />
                            <span className="whitespace-nowrap">{entry.phase}</span>
                          </span>
                          <span className="block truncate text-meta text-fg-3">{project?.name}</span>
                        </span>
                        <span className="num font-mono text-body text-fg">{formatMinutes(entry.netMinutes)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <Link href="/log" className="mt-1 inline-flex h-11 items-center gap-1.5 text-meta text-fg-2 transition-colors hover:text-fg">
              Full time log <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </section>

          {focusProject && <ProjectGlance project={focusProject} data={data} running={!!data.activeTimer} />}
        </aside>
      </div>
      {dialogs}
    </>
  );
}

function DateHeading({ now }: { now: Date }) {
  return (
    <header>
      <p className="micro mb-2">Today</p>
      <h1 className="text-title font-semibold tracking-[-0.02em] text-fg" suppressHydrationWarning>
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

function ProjectGlance({ project, data, running }: { project: Project; data: AppData; running: boolean }) {
  const { totals } = buildProjectSummary(project.id, data.estimates, data.entries);
  const diff = totals.actual - totals.original;
  const pct = variancePercent(totals.actual, totals.original);

  return (
    <section aria-labelledby="glance-heading">
      <SectionLabel id="glance-heading">{running ? "Current project" : "Selected project"}</SectionLabel>
      <div className="flex items-start justify-between gap-3 pt-4">
        <Link href={`/projects/${project.id}`} className="min-w-0 text-lead leading-snug font-medium break-words underline-offset-4 hover:underline">
          {project.name}
        </Link>
        <StatusLabel status={project.status} />
      </div>
      <ProgressBar
        className="mt-5"
        actual={totals.actual}
        planned={totals.original}
        label={`${formatMinutes(totals.actual)} recorded of ${formatMinutes(totals.original)} planned`}
      />
      <dl className="mt-4">
        <Row label="Actual" value={formatMinutes(totals.actual)} strong />
        <Row label="Original plan" value={formatMinutes(totals.original)} />
        <Row label="Revised forecast" value={totals.revised === null ? "—" : formatMinutes(totals.revised)} />
        <Row label="Δ original" value={`${formatSignedMinutes(diff)}m · ${formatPercentVariance(pct)}`} />
      </dl>
    </section>
  );
}

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline py-2.5">
      <dt className="text-meta text-fg-2">{label}</dt>
      <dd className={strong ? "num font-mono text-body font-medium text-fg" : "num font-mono text-body text-fg-2"}>{value}</dd>
    </div>
  );
}
