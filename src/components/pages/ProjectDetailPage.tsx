"use client";

import { Archive, ArchiveRestore, ArrowLeft, CircleCheck, Pencil, Plus, RotateCcw, ScrollText } from "lucide-react";
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
import { Button, InlineAlert, SectionHeading, StatusPill, cx } from "../ui";
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
      <div className="rounded-lg border border-line bg-surface">
        <EmptyState
          title="Project not found"
          action={
            <Link href="/projects" className="text-[14px] font-medium text-accent hover:text-accent-strong">
              Back to projects
            </Link>
          }
        >
          It may have been created in another browser. Data here is stored only on this device.
        </EmptyState>
      </div>
    );
  }

  const summary = buildProjectSummary(project.id, data.estimates, data.entries);
  const entries = data.entries.filter((e) => e.projectId === project.id);
  const { totals } = summary;
  const diff = totals.actual - totals.original;

  function changeStatus(status: ProjectStatus) {
    const result = run((d) => setProjectStatus(d, project!.id, status, new Date().toISOString()));
    setStatusError(result.ok ? null : result.error);
  }

  return (
    <>
      <Link href="/projects" className="inline-flex items-center gap-1.5 text-[13px] text-fg-2 transition-colors hover:text-fg">
        <ArrowLeft className="size-3.5" aria-hidden />
        Projects
      </Link>

      <header className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="min-w-0 text-[24px] leading-tight font-semibold tracking-tight break-words text-fg sm:text-[28px]">
              {project.name}
            </h1>
            <StatusPill status={project.status} />
          </div>
          {project.description && (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed break-words text-fg-2">{project.description}</p>
          )}
          <p className="mt-2 text-[12.5px] text-fg-3">Created {formatDate(project.createdAt, { year: "numeric" })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            Edit
          </Button>
          {project.status === "active" && (
            <>
              <Button size="sm" onClick={() => changeStatus("completed")}>
                <CircleCheck />
                Mark completed
              </Button>
              <Button size="sm" variant="ghost" onClick={() => changeStatus("archived")}>
                <Archive />
                Archive
              </Button>
            </>
          )}
          {project.status === "completed" && (
            <>
              <Button size="sm" onClick={() => changeStatus("active")}>
                <RotateCcw />
                Reopen
              </Button>
              <Button size="sm" variant="ghost" onClick={() => changeStatus("archived")}>
                <Archive />
                Archive
              </Button>
            </>
          )}
          {project.status === "archived" && (
            <Button size="sm" onClick={() => changeStatus("active")}>
              <ArchiveRestore />
              Restore
            </Button>
          )}
        </div>
      </header>

      {statusError && (
        <div className="mt-4">
          <InlineAlert>{statusError}</InlineAlert>
        </div>
      )}
      {project.status !== "active" && (
        <p className="mt-4 rounded-md border border-line bg-surface px-4 py-2.5 text-[13px] text-fg-2">
          {project.status === "completed"
            ? "Completed projects can’t be timed. Records stay editable for postmortem fixes."
            : "Archived projects are read-only for planning and hidden from the timer. Existing records are preserved."}
        </p>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Figure label="Original plan" value={formatMinutes(totals.original)} />
        <Figure
          label="Revised forecast"
          value={totals.revised === null ? "—" : formatMinutes(totals.revised)}
          note={totals.revised === null ? "Not revised" : undefined}
        />
        <Figure label="Actual" value={formatMinutes(totals.actual)} strong note={`${entries.length} entr${entries.length === 1 ? "y" : "ies"}`} />
        <Figure
          label="Variance vs original"
          value={`${formatSignedMinutes(diff)} min`}
          note={formatPercentVariance(variancePercent(totals.actual, totals.original))}
          tone={diff > 0 ? "over" : diff < 0 ? "under" : undefined}
        />
      </dl>

      <section className="mt-10" aria-labelledby="plan-heading">
        <SectionHeading id="plan-heading" title="Plan and actuals" />
        <ProjectSummary project={project} data={data} />
      </section>

      <section className="mt-10" aria-labelledby="log-heading">
        <SectionHeading
          id="log-heading"
          title="Time log"
          aside={
            project.status !== "archived" && (
              <Button size="sm" onClick={openAdd}>
                <Plus />
                Add entry
              </Button>
            )
          }
        />
        {entries.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface">
            <EmptyState icon={<ScrollText />} title="No time recorded yet">
              {project.status === "active"
                ? "Start a timer from Today, or add a past entry. The first saved entry locks the original estimates."
                : "This project has no recorded time."}
            </EmptyState>
          </div>
        ) : (
          <TimeEntryList
            entries={entries}
            projects={data.projects}
            now={now}
            showProject={false}
            onEdit={openEdit}
            onDelete={requestDelete}
          />
        )}
      </section>

      <ProjectForm open={editing} project={project} onClose={() => setEditing(false)} />
      {dialogs}
    </>
  );
}

function Figure({
  label,
  value,
  note,
  strong,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  strong?: boolean;
  tone?: "over" | "under";
}) {
  return (
    <div className="bg-surface px-4 py-3.5 sm:px-5">
      <dt className="text-[12px] text-fg-3">{label}</dt>
      <dd
        className={cx(
          "num mt-1 text-[19px] tracking-tight",
          strong ? "font-semibold text-fg" : "font-medium text-fg",
          tone === "over" && "text-over",
          tone === "under" && "text-under",
        )}
      >
        {value}
      </dd>
      {note && <dd className="num mt-0.5 text-[12px] text-fg-3">{note}</dd>}
    </div>
  );
}
