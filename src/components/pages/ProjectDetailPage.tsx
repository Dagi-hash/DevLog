"use client";

import { Archive, ArchiveRestore, ArrowLeft, Check, Pencil, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { buildProjectSummary, variancePercent } from "@/lib/domain/calculations";
import { formatMinutes, formatPercentVariance, formatSignedMinutes } from "@/lib/domain/format";
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

      {/* One figure, one line of context, one bar. Details live in the table below. */}
      <section aria-label="Totals" className="mt-12 lg:mt-16">
        <p className="num font-mono text-figure font-light tracking-[-0.035em] text-fg">
          {formatMinutes(totals.actual)}
          <span className="ml-3 align-middle font-sans text-body font-normal tracking-normal text-fg-3">
            of {formatMinutes(totals.original)} planned
          </span>
        </p>
        <ProgressBar
          className="mt-6 max-w-xl"
          actual={totals.actual}
          planned={totals.original}
          label={`${formatMinutes(totals.actual)} recorded of ${formatMinutes(totals.original)} originally planned`}
        />
        <p className="num mt-3 text-meta text-fg-3">
          <span className="font-mono text-fg-2">
            {formatSignedMinutes(diff)}m · {formatPercentVariance(variancePercent(totals.actual, totals.original))}
          </span>{" "}
          against the original plan
          {totals.revised !== null && (
            <>
              {" "}· forecast <span className="font-mono text-fg-2">{formatMinutes(totals.revised)}</span>
            </>
          )}
        </p>
      </section>

      <section className="mt-16 lg:mt-24" aria-labelledby="plan-heading">
        <h2 id="plan-heading" className="mb-4 text-heading font-semibold tracking-[-0.01em]">
          Plan and actuals
        </h2>
        <ProjectSummary project={project} data={data} />
      </section>

      <section className="mt-16 lg:mt-24" aria-labelledby="log-heading">
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
