"use client";

import { ChevronRight, FolderClosed, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildProjectSummary } from "@/lib/domain/calculations";
import { formatMinutes, formatRelative } from "@/lib/domain/format";
import { PROJECT_STATUSES, STATUS_LABEL, type ProjectStatus } from "@/lib/domain/psp";
import type { AppData, Project } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { useAppData } from "@/lib/state/store";
import { EmptyState } from "../EmptyState";
import { ProjectForm } from "../ProjectForm";
import { Button, ProgressBar, Segmented, StatusPill } from "../ui";

export function ProjectsPage() {
  const data = useAppData();
  const now = new Date(useNow());
  const router = useRouter();
  const [filter, setFilter] = useState<ProjectStatus>("active");
  const [creating, setCreating] = useState(false);

  const counts = Object.fromEntries(
    PROJECT_STATUSES.map((s) => [s, data.projects.filter((p) => p.status === s).length]),
  ) as Record<ProjectStatus, number>;
  const visible = data.projects
    .filter((p) => p.status === filter)
    .map((p) => ({ project: p, lastActivity: lastActivity(data, p) }))
    .sort((a, b) => (b.lastActivity ?? b.project.createdAt).localeCompare(a.lastActivity ?? a.project.createdAt));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-fg sm:text-[28px]">Projects</h1>
          <p className="mt-1 text-[14px] text-fg-2">Plans, actuals and history for each piece of work.</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus />
          New project
        </Button>
      </header>

      <Segmented
        label="Filter by status"
        name="project-filter"
        value={filter}
        onChange={setFilter}
        className="mt-6 flex w-full sm:inline-flex sm:w-auto"
        options={PROJECT_STATUSES.map((s) => ({
          value: s,
          label: (
            <span>
              {STATUS_LABEL[s]} <span className="num text-fg-3">{counts[s]}</span>
            </span>
          ),
        }))}
      />

      <div className="mt-4">
        {visible.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface">
            <EmptyState
              icon={<FolderClosed />}
              title={data.projects.length === 0 ? "No projects yet" : `No ${STATUS_LABEL[filter].toLowerCase()} projects`}
              action={
                filter === "active" ? (
                  <Button variant="primary" onClick={() => setCreating(true)}>
                    <Plus />
                    New project
                  </Button>
                ) : undefined
              }
            >
              {filter === "active"
                ? "Create a project to plan your phases and start recording time."
                : filter === "completed"
                  ? "Projects you mark as completed keep their records and summaries here."
                  : "Archived projects are read-only and hidden from the timer."}
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            <li className="hidden grid-cols-[minmax(0,1fr)_96px_96px_150px_104px_16px] items-center gap-5 bg-bg/40 px-5 py-2 text-[12px] font-medium text-fg-3 lg:grid">
              <span>Project</span>
              <span className="text-right">Planned</span>
              <span className="text-right">Actual</span>
              <span>Progress</span>
              <span>Last activity</span>
              <span />
            </li>
            {visible.map(({ project, lastActivity }) => (
              <ProjectRow key={project.id} project={project} data={data} lastActivity={lastActivity} now={now} />
            ))}
          </ul>
        )}
      </div>

      <ProjectForm open={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/projects/${id}`)} />
    </>
  );
}

function lastActivity(data: AppData, project: Project): string | null {
  let latest: string | null = null;
  for (const e of data.entries) if (e.projectId === project.id && (!latest || e.endedAt > latest)) latest = e.endedAt;
  return latest;
}

function ProjectRow({
  project,
  data,
  lastActivity,
  now,
}: {
  project: Project;
  data: AppData;
  lastActivity: string | null;
  now: Date;
}) {
  const { totals } = buildProjectSummary(project.id, data.estimates, data.entries);
  const running = data.activeTimer?.projectId === project.id;
  const barLabel = `${formatMinutes(totals.actual)} recorded of ${formatMinutes(totals.original)} planned`;
  return (
    <li>
      <Link
        href={`/projects/${project.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-white/[0.02] sm:px-5 lg:grid-cols-[minmax(0,1fr)_96px_96px_150px_104px_16px] lg:items-center lg:gap-5 lg:py-3.5"
      >
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[15px] font-medium text-fg">{project.name}</span>
            {running && (
              <span className="size-1.5 shrink-0 animate-pulse-dot rounded-full bg-under" aria-label="Timer running" />
            )}
            <span className="hidden lg:inline-flex">
              <StatusPill status={project.status} />
            </span>
          </p>
          {project.description && <p className="mt-0.5 truncate text-[13px] text-fg-3">{project.description}</p>}
        </div>
        <div className="justify-self-end lg:hidden">
          <StatusPill status={project.status} />
        </div>

        <p className="num hidden text-right text-[14px] text-fg-2 lg:block">{formatMinutes(totals.original)}</p>
        <p className="num hidden text-right text-[14px] font-semibold text-fg lg:block">{formatMinutes(totals.actual)}</p>
        <div className="col-span-2 lg:col-span-1">
          <p className="num mb-1.5 flex justify-between text-[12.5px] text-fg-2 lg:hidden">
            <span>
              <span className="font-semibold text-fg">{formatMinutes(totals.actual)}</span> of {formatMinutes(totals.original)} planned
            </span>
            <span className="text-fg-3">{lastActivity ? formatRelative(lastActivity, now) : "No time yet"}</span>
          </p>
          <ProgressBar actual={totals.actual} planned={totals.original} label={barLabel} />
        </div>
        <p className="hidden text-[13px] text-fg-3 lg:block">
          {lastActivity ? formatRelative(lastActivity, now) : "No time yet"}
        </p>
        <ChevronRight className="hidden size-4 text-fg-3 transition-transform group-hover:translate-x-0.5 lg:block" aria-hidden />
      </Link>
    </li>
  );
}
