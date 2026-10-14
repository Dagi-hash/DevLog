"use client";

import { useState } from "react";
import { formatDate, formatMinutes } from "@/lib/domain/format";
import type { AppData, TimeEntry } from "@/lib/domain/types";
import { deleteEntry } from "@/lib/state/actions";
import { run } from "@/lib/state/store";
import { ConfirmDialog } from "./ConfirmDialog";
import { TimeEntryForm } from "./TimeEntryForm";

/** Shared add / edit / delete-with-confirmation dialogs for time entries. */
export function useEntryDialogs(data: AppData, defaultProjectId?: string | null) {
  const [form, setForm] = useState<{ entry?: TimeEntry } | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);

  const dialogs = (
    <>
      <TimeEntryForm
        open={form !== null}
        data={data}
        entry={form?.entry}
        defaultProjectId={defaultProjectId}
        onClose={() => setForm(null)}
        onDelete={(entry) => {
          setForm(null);
          setDeleting(entry);
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this entry?"
        description={
          deleting
            ? `${formatMinutes(deleting.netMinutes)} of ${deleting.phase} on ${formatDate(deleting.startedAt)} will be removed and project totals recalculated. This can’t be undone.`
            : ""
        }
        confirmLabel="Delete entry"
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          const target = deleting;
          const result = run((d) => deleteEntry(d, target.id, new Date().toISOString()));
          return result.ok ? undefined : result.error;
        }}
      />
    </>
  );

  return {
    openAdd: () => setForm({}),
    openEdit: (entry: TimeEntry) => setForm({ entry }),
    requestDelete: (entry: TimeEntry) => setDeleting(entry),
    dialogs,
  };
}
