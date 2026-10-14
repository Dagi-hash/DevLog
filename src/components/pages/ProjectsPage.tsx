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
import { Button, PageHeader, ProgressBar, RecordingDot, TabFilter } from "../ui";

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
      <PageHeader title="Projects">
        <Button variant="primary" onClick={() => setCreating(true)} className="rounded-full">
          <Plus aria-hidden />
          New project
        </Button>
      </PageHeader>

      <div className="mt-10">
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
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 py-5 transition-colors hover:bg-hover lg:grid-cols-[minmax(0,1fr)_200px_180px_20px] lg:py-6"
      >
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-3">
            <span className="text-lead break-words text-fg lg:truncate">{project.name}</span>
            {running && (
              <span className="inline-flex shrink-0 items-center gap-1.5 text-meta text-fg-2">
                <RecordingDot className="size-1.5" />
                <span className="sr-only lg:not-sr-only">Recording</span>
              </span>
            )}
          </p>
          <p className="mt-1 text-meta text-fg-3">{activity}</p>
        </div>
        <p className="num text-right text-body text-fg lg:order-none">
          {formatMinutes(totals.actual)}
          <span className="text-fg-3"> / {formatMinutes(totals.original)}</span>
        </p>
        <ProgressBar className="col-span-2 lg:col-span-1" actual={totals.actual} planned={totals.original} label={barLabel} />
        <ChevronRight className="hidden size-4 text-fg-4 transition-transform group-hover:translate-x-0.5 lg:block" aria-hidden />
      </Link>
    </li>
  );
}
