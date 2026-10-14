"use client";

import { Archive, ArchiveRestore, ArrowLeft, Check, Pencil, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { buildProjectSummary, variancePercent } from "@/lib/domain/calculations";
import { formatDate, formatMinutes, formatPercentVariance, formatSignedMinutes } from "@/lib/domain/format";
import type { ProjectStatus } from "@/lib/domain/psp";
import { setProjectStatus } from "@/lib/state/actions";
import { run, useAppData } from "@/lib/state/store";
import { useNow } from "@/lib/hooks/useNow";
import { EmptyState } from "../EmptyState";
import { ProjectForm } from "../ProjectForm";
import { ProjectSummary } from "../ProjectSummary";
import { TimeEntryList } from "../TimeEntryList";
import { Button, InlineAlert, ProgressBar, StatusLabel } from "../ui";
import { useEntryDialogs } from "../useEntryDialogs";

export function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const data = useAppData();
  const now = new Date(useNow());
  const project = data.projects.find((p) => p.id === params.id);
  const [editing, setEditing] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const { openAdd, openEdit, requestDelete, dialogs } = useEntryDialogs(data, project?.id);

  if (!project) {
    return (
      <div className="max-w-xl">
        <BackLink />
        <div className="mt-8">
          <EmptyState title="Project not found">
            It may have been created in another browser. Data here is stored only on this device.
          </EmptyState>
        </div>
      </div>
    );
  }

  const { totals } = buildProjectSummary(project.id, data.estimates, data.entries);
  const entries = data.entries.filter((e) => e.projectId === project.id);
  const diff = totals.actual - totals.original;

  function changeStatus(status: ProjectStatus) {
    const result = run((d) => setProjectStatus(d, project!.id, status, new Date().toISOString()));
    setStatusError(result.ok ? null : result.error);
  }

  return (
    <>
      <BackLink />

      <header className="mt-6 grid gap-6 lg:grid-cols-12 lg:gap-x-16">
        <div className="min-w-0 lg:col-span-7">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <StatusLabel status={project.status} />
            <span className="num font-mono text-meta text-fg-3">Created {formatDate(project.createdAt, { year: "numeric" })}</span>
          </div>
          <h1 className="text-title font-semibold tracking-[-0.02em] break-words text-fg">{project.name}</h1>
          {project.description && <p className="mt-3 max-w-2xl text-body leading-relaxed break-words text-fg-2">{project.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2 lg:col-span-5 lg:justify-end lg:self-end">
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil aria-hidden />
            Edit
          </Button>
          {project.status === "active" && (
            <>
              <Button size="sm" onClick={() => changeStatus("completed")}>
                <Check aria-hidden />
                Mark completed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => changeStatus("archived")}>
                <Archive aria-hidden />
                Archive
              </Button>
            </>
          )}
          {project.status === "completed" && (
            <>
              <Button size="sm" onClick={() => changeStatus("active")}>
                <RotateCcw aria-hidden />
                Reopen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => changeStatus("archived")}>
                <Archive aria-hidden />
                Archive
              </Button>
            </>
          )}
          {project.status === "archived" && (
            <Button size="sm" onClick={() => changeStatus("active")}>
              <ArchiveRestore aria-hidden />
              Restore
            </Button>
          )}
        </div>
      </header>

      {statusError && (
        <div className="mt-5">
          <InlineAlert>{statusError}</InlineAlert>
        </div>
      )}
      {project.status !== "active" && (
        <p className="mt-5 border-l-2 border-fg-3 py-1 pl-3 text-meta text-fg-2">
          {project.status === "completed"
            ? "Completed projects can’t be timed. Records stay editable for postmortem fixes."
            : "Archived projects are read-only for planning and hidden from the timer. Existing records are preserved."}
        </p>
      )}

      {/* One dominant figure, supporting figures set as a line of type — not cards. */}
      <section aria-label="Totals" className="mt-10 border-t border-hairline pt-6 lg:mt-14">
        <div className="grid gap-6 lg:grid-cols-12 lg:items-end lg:gap-x-16">
          <div className="lg:col-span-5">
            <p className="micro">Actual to date</p>
            <p className="num mt-2 font-mono text-figure font-light tracking-[-0.03em] text-fg">{formatMinutes(totals.actual)}</p>
            <p className="mt-2 text-meta text-fg-3">
              {entries.length} entr{entries.length === 1 ? "y" : "ies"}
            </p>
          </div>
          <dl className="grid grid-cols-3 gap-4 lg:col-span-7">
            <Figure label="Original plan" value={formatMinutes(totals.original)} />
            <Figure label="Revised forecast" value={totals.revised === null ? "—" : formatMinutes(totals.revised)} />
            <Figure
              label="Δ original"
              value={`${formatSignedMinutes(diff)}m`}
              note={formatPercentVariance(variancePercent(totals.actual, totals.original))}
            />
          </dl>
        </div>
        <ProgressBar
          className="mt-6"
          actual={totals.actual}
          planned={totals.original}
          label={`${formatMinutes(totals.actual)} recorded of ${formatMinutes(totals.original)} originally planned`}
        />
      </section>

      <section className="mt-14 lg:mt-20" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="mb-4 text-heading font-semibold tracking-[-0.01em]">
          Plan and actuals
        </h2>
        <ProjectSummary project={project} data={data} />
      </section>

      <section className="mt-14 lg:mt-20" aria-labelledby="log-heading">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 id="log-heading" className="text-heading font-semibold tracking-[-0.01em]">
            Time log
          </h2>
          {project.status !== "archived" && (
            <Button size="sm" onClick={openAdd}>
              <Plus aria-hidden />
              Add entry
            </Button>
          )}
        </div>
        {entries.length === 0 ? (
          <EmptyState title="No time recorded yet">
            {project.status === "active"
              ? "Start a timer from Today, or add a past entry. The first saved entry locks the original estimates."
              : "This project has no recorded time."}
          </EmptyState>
        ) : (
          <TimeEntryList entries={entries} projects={data.projects} now={now} showProject={false} onEdit={openEdit} onDelete={requestDelete} />
        )}
      </section>

      <ProjectForm open={editing} project={project} onClose={() => setEditing(false)} />
      {dialogs}
    </>
  );
}

function BackLink() {
  return (
    <Link href="/projects" className="-ml-1 inline-flex h-9 items-center gap-1.5 px-1 text-meta text-fg-2 transition-colors hover:text-fg">
      <ArrowLeft className="size-3.5" aria-hidden />
      Projects
    </Link>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0 border-l border-hairline pl-4">
      <dt className="text-meta text-fg-3">{label}</dt>
      <dd className="num mt-1.5 truncate font-mono text-lead text-fg">{value}</dd>
      {note && <dd className="num font-mono text-meta text-fg-3">{note}</dd>}
    </div>
  );
}

