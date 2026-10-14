"use client";

import { Plus, ScrollText } from "lucide-react";
import { useState } from "react";
import { sumNetMinutes } from "@/lib/domain/calculations";
import { formatMinutes } from "@/lib/domain/format";
import { WORK_MODES, WORK_MODE_INFO, isWorkMode, type WorkMode } from "@/lib/domain/psp";
import { useNow } from "@/lib/hooks/useNow";
import { useAppData } from "@/lib/state/store";
import { EmptyState } from "../EmptyState";
import { TimeEntryList } from "../TimeEntryList";
import { Button, Select } from "../ui";
import { useEntryDialogs } from "../useEntryDialogs";

export function TimeLogPage() {
  const data = useAppData();
  const now = new Date(useNow());
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<WorkMode | "all">("all");
  const { openAdd, openEdit, requestDelete, dialogs } = useEntryDialogs(
    data,
    projectFilter === "all" ? null : projectFilter,
  );

  const filtered = data.entries.filter(
    (e) => (projectFilter === "all" || e.projectId === projectFilter) && (modeFilter === "all" || e.workMode === modeFilter),
  );
  const filtering = projectFilter !== "all" || modeFilter !== "all";
  const canAdd = data.projects.some((p) => p.status !== "archived");

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-tight text-fg sm:text-[28px]">Time log</h1>
          <p className="mt-1 text-[14px] text-fg-2">Every saved entry, newest first.</p>
        </div>
        <Button variant="primary" onClick={openAdd} disabled={!canAdd}>
          <Plus />
          Add entry
        </Button>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        <label className="sr-only" htmlFor="log-project">
          Filter by project
        </label>
        <Select
          id="log-project"
          value={projectFilter}
          onChange={(event) => setProjectFilter(event.target.value)}
          className="sm:w-64"
        >
          <option value="all">All projects</option>
          {data.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <label className="sr-only" htmlFor="log-mode">
          Filter by work mode
        </label>
        <Select
          id="log-mode"
          value={modeFilter}
          onChange={(event) => setModeFilter(isWorkMode(event.target.value) ? event.target.value : "all")}
          className="sm:w-48"
        >
          <option value="all">All work modes</option>
          {WORK_MODES.map((m) => (
            <option key={m} value={m}>
              {WORK_MODE_INFO[m].label}
            </option>
          ))}
        </Select>
        <p className="num col-span-2 text-[13px] text-fg-2 sm:ml-auto" aria-live="polite">
          {filtered.length} entr{filtered.length === 1 ? "y" : "ies"} ·{" "}
          <span className="font-semibold text-fg">{formatMinutes(sumNetMinutes(filtered))}</span>
          {filtering && <span className="text-fg-3"> of {formatMinutes(sumNetMinutes(data.entries))} total</span>}
        </p>
      </div>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface">
            <EmptyState icon={<ScrollText />} title={filtering ? "No matching entries" : "No time recorded yet"}>
              {filtering
                ? "Try a different project or work mode."
                : "Entries appear here when you stop a timer or add past work."}
            </EmptyState>
          </div>
        ) : (
          <TimeEntryList entries={filtered} projects={data.projects} now={now} onEdit={openEdit} onDelete={requestDelete} />
        )}
      </div>
      {dialogs}
    </>
  );
}
