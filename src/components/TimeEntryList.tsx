"use client";

import { ChevronRight, Pencil, Trash2 } from "lucide-react";
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
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.key} aria-label={formatDayHeading(group.key, now)}>
          <div className="flex items-baseline justify-between border-b border-hairline pb-2">
            <h3 className="text-body font-medium text-fg">{formatDayHeading(group.key, now)}</h3>
            <span className="num text-meta text-fg-2">{formatMinutes(sumNetMinutes(group.entries))}</span>
          </div>
          <ul>
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
  const label = `Edit ${entry.phase} entry, ${formatMinutes(entry.netMinutes)}, ${formatTime(entry.startedAt)} to ${formatTime(entry.endedAt)}`;

  return (
    <li className="flex items-stretch border-b border-hairline">
      {/* The whole row opens the editor (the touch interaction); desktop adds explicit buttons. */}
      <button
        type="button"
        onClick={() => onEdit(entry)}
        aria-label={label}
        className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_16px] items-start gap-x-4 gap-y-1 py-3.5 text-left transition-colors hover:bg-hover lg:grid-cols-[120px_minmax(0,1fr)_88px] lg:items-center lg:px-2"
      >
        <span className="num order-3 col-span-3 text-meta text-fg-3 lg:order-none lg:col-span-1">
          {formatTime(entry.startedAt)}–{formatTime(entry.endedAt)}
          {crossesDay && " +1d"}
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="text-body font-medium text-fg">{entry.phase}</span>
            <ModeTag mode={entry.workMode} />
            {entry.sessionId === null && <span className="text-meta text-fg-3">added manually</span>}
          </span>
          {showProject && project && <span className="mt-0.5 block truncate text-meta text-fg-2">{project.name}</span>}
          {entry.description && <span className="mt-0.5 block text-meta break-words text-fg-3">{entry.description}</span>}
        </span>
        <span className="num text-right text-body text-fg">
          {formatMinutes(entry.netMinutes)}
          {entry.interruptionMinutes > 0 && (
            <span className="block text-tiny text-fg-3">−{entry.interruptionMinutes}m int.</span>
          )}
        </span>
        <ChevronRight className="mt-0.5 size-4 text-fg-4 lg:hidden" aria-hidden />
      </button>
      <div className="hidden items-center gap-1 pl-4 lg:flex">
        <button
          type="button"
          onClick={() => onEdit(entry)}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-meta text-fg-2 transition-colors hover:bg-hover hover:text-fg"
        >
          <Pencil className="size-3.5" aria-hidden />
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry)}
          className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-meta text-fg-2 transition-colors hover:bg-hover hover:text-fg"
        >
          <Trash2 className="size-3.5" aria-hidden />
          Delete
        </button>
      </div>
    </li>
  );
}
