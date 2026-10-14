"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { sumNetMinutes } from "@/lib/domain/calculations";
import { formatMinutes } from "@/lib/domain/format";
import { WORK_MODES, WORK_MODE_INFO, isWorkMode, type WorkMode } from "@/lib/domain/psp";
import { useNow } from "@/lib/hooks/useNow";
import { useAppData } from "@/lib/state/store";
import { EmptyState } from "../EmptyState";
import { TimeEntryList } from "../TimeEntryList";
import { Button, PageHeader, Select } from "../ui";
import { useEntryDialogs } from "../useEntryDialogs";

export function TimeLogPage() {
  const data = useAppData();
  const now = new Date(useNow());
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [modeFilter, setModeFilter] = useState<WorkMode | "all">("all");
  const { openAdd, openEdit, requestDelete, dialogs } = useEntryDialogs(data, projectFilter === "all" ? null : projectFilter);

  const filtered = data.entries.filter(
    (e) => (projectFilter === "all" || e.projectId === projectFilter) && (modeFilter === "all" || e.workMode === modeFilter),
  );
  const filtering = projectFilter !== "all" || modeFilter !== "all";
  const canAdd = data.projects.some((p) => p.status !== "archived");

  return (
    <>
      <PageHeader title="Time log">
        <Button variant="primary" onClick={openAdd} disabled={!canAdd} className="rounded-full">
          <Plus aria-hidden />
          Add entry
        </Button>
      </PageHeader>

      <div className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <p className="num text-body text-fg-3" aria-live="polite">
          <span className="font-mono text-fg">{formatMinutes(sumNetMinutes(filtered))}</span> across {filtered.length} entr
          {filtered.length === 1 ? "y" : "ies"}
          {filtering && <span> · {formatMinutes(sumNetMinutes(data.entries))} overall</span>}
        </p>
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <div>
            <label className="sr-only" htmlFor="log-project">
              Filter by project
            </label>
            <Select id="log-project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="lg:w-60">
              <option value="all">All projects</option>
              {data.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="sr-only" htmlFor="log-mode">
              Filter by work mode
            </label>
            <Select
              id="log-mode"
              value={modeFilter}
              onChange={(event) => setModeFilter(isWorkMode(event.target.value) ? event.target.value : "all")}
              className="lg:w-44"
            >
              <option value="all">All work modes</option>
              {WORK_MODES.map((m) => (
                <option key={m} value={m}>
                  {WORK_MODE_INFO[m].label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="mt-10">
        {filtered.length === 0 ? (
          <EmptyState title={filtering ? "No matching entries" : "No time recorded yet"}>
            {filtering ? "Try a different project or work mode." : "Entries appear here when you stop a timer or add past work."}
          </EmptyState>
        ) : (
          <TimeEntryList entries={filtered} projects={data.projects} now={now} onEdit={openEdit} onDelete={requestDelete} />
        )}
      </div>
      {dialogs}
    </>
  );
}
