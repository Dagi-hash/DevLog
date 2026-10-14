"use client";

import { ChevronRight, Plus } from "lucide-react";
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
import { Button, PageHeader, ProgressBar, RecordingDot, StatusLabel, TabFilter } from "../ui";

const EMPTY_COPY: Record<ProjectStatus, string> = {
  active: "Create a project to plan its phases and start recording time.",
  completed: "Projects you mark as completed keep their records and summaries here.",
  archived: "Archived projects are read-only and hidden from the timer.",
};

export function ProjectsPage() {
  const data = useAppData();
  const now = new Date(useNow());
  const router = useRouter();
  const [filter, setFilter] = useState<ProjectStatus>("active");
  const [creating, setCreating] = useState(false);

  const visible = data.projects
    .filter((p) => p.status === filter)
    .map((p) => ({ project: p, lastActivity: lastActivity(data, p) }))
    .sort((a, b) => (b.lastActivity ?? b.project.createdAt).localeCompare(a.lastActivity ?? a.project.createdAt));

  return (
    <>
      <PageHeader eyebrow={`${data.projects.length} project${data.projects.length === 1 ? "" : "s"}`} title="Projects">
        <Button variant="primary" onClick={() => setCreating(true)} className="w-full sm:w-auto">
          <Plus aria-hidden />
          New project
        </Button>
      </PageHeader>

      <div className="mt-8">
        <TabFilter
          label="Filter by status"
          name="project-filter"
          value={filter}
          onChange={setFilter}
          options={PROJECT_STATUSES.map((s) => ({
            value: s,
            label: STATUS_LABEL[s],
            count: data.projects.filter((p) => p.status === s).length,
          }))}
        />
      </div>

      {visible.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title={data.projects.length === 0 ? "No projects yet" : `No ${STATUS_LABEL[filter].toLowerCase()} projects`}
            action={
              filter === "active" ? (
                <Button variant="primary" onClick={() => setCreating(true)}>
                  <Plus aria-hidden />
                  New project
                </Button>
              ) : undefined
            }
          >
            {EMPTY_COPY[filter]}
          </EmptyState>
        </div>
      ) : (
        <ul className="mt-2">
          <li aria-hidden className="hidden grid-cols-[minmax(0,1fr)_96px_96px_160px_112px_16px] items-center gap-6 border-b border-hairline py-3 lg:grid">
            <span className="micro">Project</span>
            <span className="micro text-right">Planned</span>
            <span className="micro text-right">Actual</span>
            <span className="micro">Progress</span>
            <span className="micro">Last activity</span>
            <span />
          </li>
          {visible.map(({ project, lastActivity }) => (
            <ProjectRow key={project.id} project={project} data={data} lastActivity={lastActivity} now={now} />
          ))}
        </ul>
      )}

      <ProjectForm open={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/projects/${id}`)} />
    </>
  );
}

function lastActivity(data: AppData, project: Project): string | null {
  let latest: string | null = null;
  for (const e of data.entries) if (e.projectId === project.id && (!latest || e.endedAt > latest)) latest = e.endedAt;
  return latest;
}

function ProjectRow({ project, data, lastActivity, now }: { project: Project; data: AppData; lastActivity: string | null; now: Date }) {
  const { totals } = buildProjectSummary(project.id, data.estimates, data.entries);
  const running = data.activeTimer?.projectId === project.id;
  const activity = lastActivity ? formatRelative(lastActivity, now) : "No time yet";
  const barLabel = `${formatMinutes(totals.actual)} recorded of ${formatMinutes(totals.original)} planned`;

  return (
    <li className="border-b border-hairline">
      <Link
        href={`/projects/${project.id}`}
        className="group grid grid-cols-[minmax(0,1fr)_16px] gap-x-4 gap-y-3 py-5 transition-colors hover:bg-hover lg:grid-cols-[minmax(0,1fr)_96px_96px_160px_112px_16px] lg:items-center lg:gap-6 lg:py-4"
      >
        <div className="min-w-0">
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-lead font-medium break-words text-fg lg:truncate">{project.name}</span>
            <StatusLabel status={project.status} />
            {running && (
              <span className="inline-flex items-center gap-1.5 text-meta text-fg">
                <RecordingDot className="size-1.5" />
                Recording
              </span>
            )}
          </p>
          {project.description && <p className="mt-1 truncate text-meta text-fg-3">{project.description}</p>}
        </div>
        <ChevronRight className="mt-1 size-4 self-start text-fg-4 transition-transform group-hover:translate-x-0.5 lg:order-last lg:mt-0 lg:self-center" aria-hidden />

        <p className="num hidden text-right font-mono text-body text-fg-2 lg:block">{formatMinutes(totals.original)}</p>
        <p className="num hidden text-right font-mono text-body text-fg lg:block">{formatMinutes(totals.actual)}</p>
        <div className="col-span-2 lg:col-span-1">
          <p className="num mb-2.5 flex items-baseline justify-between gap-3 text-meta lg:hidden">
            <span className="font-mono text-fg">
              {formatMinutes(totals.actual)}
              <span className="text-fg-3"> / {formatMinutes(totals.original)}</span>
            </span>
            <span className="text-fg-3">{activity}</span>
          </p>
          <ProgressBar actual={totals.actual} planned={totals.original} label={barLabel} />
        </div>
        <p className="hidden text-meta text-fg-3 lg:block">{activity}</p>
      </Link>
    </li>
  );
}
