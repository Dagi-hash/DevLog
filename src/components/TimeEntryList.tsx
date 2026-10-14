"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { sumNetMinutes } from "@/lib/domain/calculations";
import { formatDayHeading, formatMinutes, formatTime, localDayKey } from "@/lib/domain/format";
import type { Project, TimeEntry } from "@/lib/domain/types";
import { ModeTag } from "./ui";

/** Entries grouped by local day, newest first. */
export function TimeEntryList({
  entries,
  projects,
  now,
  showProject = true,
  onEdit,
  onDelete,
}: {
  entries: readonly TimeEntry[];
  projects: readonly Project[];
  now: Date;
  showProject?: boolean;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}) {
  const sorted = [...entries].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  const groups: Array<{ key: string; entries: TimeEntry[] }> = [];
  for (const entry of sorted) {
    const key = localDayKey(entry.startedAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.entries.push(entry);
    else groups.push({ key, entries: [entry] });
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.key} aria-label={formatDayHeading(group.key, now)}>
          <div className="mb-1.5 flex items-baseline justify-between px-1">
            <h3 className="text-[13px] font-semibold text-fg-2">{formatDayHeading(group.key, now)}</h3>
            <span className="num text-[12.5px] text-fg-3">{formatMinutes(sumNetMinutes(group.entries))}</span>
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
            {group.entries.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                project={projects.find((p) => p.id === entry.projectId)}
                showProject={showProject}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function EntryRow({
  entry,
  project,
  showProject,
  onEdit,
  onDelete,
}: {
  entry: TimeEntry;
  project?: Project;
  showProject: boolean;
  onEdit: (entry: TimeEntry) => void;
  onDelete: (entry: TimeEntry) => void;
}) {
  const crossesDay = localDayKey(entry.startedAt) !== localDayKey(entry.endedAt);
  return (
    <li className="group grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[112px_1fr_auto_auto] sm:items-center">
      <p className="num order-2 col-span-2 font-mono text-[12.5px] text-fg-3 sm:order-none sm:col-span-1">
        {formatTime(entry.startedAt)}–{formatTime(entry.endedAt)}
        {crossesDay && <span title="Ends on the next day"> +1d</span>}
        {entry.interruptionMinutes > 0 && (
          <span className="ml-2 font-sans text-[12px] sm:ml-0 sm:block">−{entry.interruptionMinutes}m interrupted</span>
        )}
      </p>
      <div className="order-1 min-w-0 sm:order-none">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[14px]">
          <span className="font-medium text-fg">{entry.phase}</span>
          <ModeTag mode={entry.workMode} />
          {entry.sessionId === null && <span className="text-[11.5px] text-fg-3">manual entry</span>}
        </p>
        {showProject && project && (
          <Link
            href={`/projects/${project.id}`}
            className="mt-0.5 block truncate text-[13px] text-fg-2 hover:text-fg"
          >
            {project.name}
          </Link>
        )}
        {entry.description && <p className="mt-0.5 text-[13px] break-words text-fg-3">{entry.description}</p>}
      </div>
      <p className="num order-1 self-start text-right text-[15px] font-semibold text-fg sm:order-none sm:self-center">
        {formatMinutes(entry.netMinutes)}
      </p>
      <div className="order-3 col-span-2 -mb-1 flex justify-end gap-1 sm:order-none sm:col-span-1 sm:mb-0">
        <button
          type="button"
          onClick={() => onEdit(entry)}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12.5px] text-fg-2 transition-colors hover:bg-white/5 hover:text-fg"
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry)}
          className="inline-flex h-8 items-center gap-1.5 rounded-sm px-2 text-[12.5px] text-fg-2 transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete
        </button>
      </div>
    </li>
  );
}
