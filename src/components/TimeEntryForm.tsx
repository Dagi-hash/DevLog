"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { formatMinutes, localDayKey } from "@/lib/domain/format";
import { PHASES, WORK_MODES, WORK_MODE_INFO, type Phase, type WorkMode } from "@/lib/domain/psp";
import type { AppData, TimeEntry } from "@/lib/domain/types";
import { isValid, validateEntry, type EntryField } from "@/lib/domain/validation";
import { addManualEntry, createId, updateEntry } from "@/lib/state/actions";
import { run } from "@/lib/state/store";
import { Dialog } from "./Dialog";
import { Button, Field, InlineAlert, ModeGlyph, Segmented, Select, TextArea, TextInput } from "./ui";

interface TimeEntryFormProps {
  open: boolean;
  data: AppData;
  /** Present when editing an existing entry. */
  entry?: TimeEntry;
  defaultProjectId?: string | null;
  onClose: () => void;
  /** Present when editing: asks for confirmation before deleting. */
  onDelete?: (entry: TimeEntry) => void;
}

/** Add a past entry or correct an existing one. Durations are recomputed from the times. */
export function TimeEntryForm(props: TimeEntryFormProps) {
  if (!props.open) return null;
  return <TimeEntryFormDialog {...props} />;
}

function toLocalTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Local date + time inputs → ISO, or "" when incomplete/invalid. */
function toIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return "";
  const d = new Date(`${date}T${time}:00`);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function defaultTimes() {
  const end = new Date();
  end.setSeconds(0, 0);
  end.setMinutes(end.getMinutes() - (end.getMinutes() % 5));
  const start = new Date(end.getTime() - 30 * 60_000);
  return { start: start.toISOString(), end: end.toISOString() };
}

function TimeEntryFormDialog({ data, entry, defaultProjectId, onClose, onDelete }: TimeEntryFormProps) {
  const selectable = data.projects.filter((p) => p.status !== "archived" || p.id === entry?.projectId);
  const initialProject =
    entry?.projectId ??
    selectable.find((p) => p.id === defaultProjectId && p.status !== "archived")?.id ??
    selectable.find((p) => p.status === "active")?.id ??
    "";
  const [initialTimes] = useState(() => (entry ? { start: entry.startedAt, end: entry.endedAt } : defaultTimes()));

  const [projectId, setProjectId] = useState(initialProject);
  const [phase, setPhase] = useState<Phase>(entry?.phase ?? "Code");
  const [workMode, setWorkMode] = useState<WorkMode>(entry?.workMode ?? "manual");
  const [startDate, setStartDate] = useState(localDayKey(initialTimes.start));
  const [startTime, setStartTime] = useState(toLocalTime(initialTimes.start));
  const [endDate, setEndDate] = useState(localDayKey(initialTimes.end));
  const [endTime, setEndTime] = useState(toLocalTime(initialTimes.end));
  const [interruption, setInterruption] = useState(String(entry?.interruptionMinutes ?? 0));
  const [description, setDescription] = useState(entry?.description ?? "");
  const [touched, setTouched] = useState<Partial<Record<EntryField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Keep second-level precision of untouched timer timestamps so editing other
  // fields never shifts the rounded duration.
  const startedAt =
    startDate === localDayKey(initialTimes.start) && startTime === toLocalTime(initialTimes.start)
      ? initialTimes.start
      : toIso(startDate, startTime);
  const endedAt =
    endDate === localDayKey(initialTimes.end) && endTime === toLocalTime(initialTimes.end)
      ? initialTimes.end
      : toIso(endDate, endTime);

  const draft = { projectId, phase, workMode, startedAt, endedAt, interruption, description };
  const validation = validateEntry(draft);
  const show = (field: EntryField) => (submitted || touched[field] ? validation.errors[field] : undefined);
  const touch = (field: EntryField) => setTouched((t) => ({ ...t, [field]: true }));

  function submit() {
    setSubmitted(true);
    if (!isValid(validation)) return;
    const nowIso = new Date().toISOString();
    const result = run((d) =>
      entry ? updateEntry(d, entry.id, draft, nowIso) : addManualEntry(d, draft, nowIso, createId()),
    );
    if (!result.ok) {
      setSaveError(result.error);
      return;
    }
    onClose();
  }

  const projectLocked = (() => {
    const p = data.projects.find((x) => x.id === projectId);
    return p && p.baselineLockedAt === null && !entry;
  })();

  return (
    <Dialog
      open
      onClose={onClose}
      onSubmit={submit}
      title={entry ? "Edit time entry" : "Add time entry"}
      footer={
        <>
          {entry && onDelete && (
            <Button variant="ghost" onClick={() => onDelete(entry)} className="sm:mr-auto">
              <Trash2 aria-hidden />
              Delete entry
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            {entry ? "Save changes" : "Add entry"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Project" htmlFor="entry-project" error={show("projectId")}>
          <Select
            id="entry-project"
            value={projectId}
            invalid={!!show("projectId")}
            onChange={(event) => {
              setProjectId(event.target.value);
              touch("projectId");
            }}
          >
            {projectId === "" && <option value="">Choose a project…</option>}
            {selectable.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.status !== "active" ? ` (${p.status})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phase" htmlFor="entry-phase" error={show("phase")}>
            <Select id="entry-phase" value={phase} onChange={(event) => setPhase(event.target.value as Phase)}>
              {PHASES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-meta text-fg-2">Work mode</span>
            <Segmented
              label="Work mode"
              name="entry-mode"
              value={workMode}
              onChange={setWorkMode}
              className="h-11 [&>label]:h-auto"
              options={WORK_MODES.map((m) => ({
                value: m,
                label: (
                  <>
                    <ModeGlyph mode={m} />
                    {WORK_MODE_INFO[m].short}
                  </>
                ),
              }))}
            />
          </div>
        </div>

        <fieldset className="grid grid-cols-2 gap-x-3 gap-y-5">
          <legend className="sr-only">Start and end</legend>
          <Field label="Start date" htmlFor="entry-start-date" error={show("startedAt")}>
            <TextInput
              id="entry-start-date"
              type="date"
              value={startDate}
              invalid={!!show("startedAt")}
              onChange={(event) => setStartDate(event.target.value)}
              onBlur={() => touch("startedAt")}
            />
          </Field>
          <Field label="Start time" htmlFor="entry-start-time">
            <TextInput
              id="entry-start-time"
              type="time"
              value={startTime}
              invalid={!!show("startedAt")}
              onChange={(event) => setStartTime(event.target.value)}
              onBlur={() => touch("startedAt")}
            />
          </Field>
          <Field label="End date" htmlFor="entry-end-date" error={show("endedAt")}>
            <TextInput
              id="entry-end-date"
              type="date"
              value={endDate}
              invalid={!!show("endedAt")}
              onChange={(event) => setEndDate(event.target.value)}
              onBlur={() => touch("endedAt")}
            />
          </Field>
          <Field label="End time" htmlFor="entry-end-time">
            <TextInput
              id="entry-end-time"
              type="time"
              value={endTime}
              invalid={!!show("endedAt")}
              onChange={(event) => setEndTime(event.target.value)}
              onBlur={() => touch("endedAt")}
            />
          </Field>
        </fieldset>

        <div className="grid grid-cols-2 items-end gap-4">
          <Field label="Interruptions (min)" htmlFor="entry-interruption" error={show("interruption")}>
            <TextInput
              id="entry-interruption"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className="num font-mono"
              value={interruption}
              invalid={!!show("interruption")}
              onChange={(event) => {
                setInterruption(event.target.value);
                touch("interruption");
              }}
              onFocus={(event) => event.target.select()}
            />
          </Field>
          <div className="flex h-full flex-col justify-end border-l border-border pb-0.5 pl-4">
            <p className="micro">Recorded</p>
            <p className="num mt-1.5 font-mono text-[22px] leading-none text-fg" data-testid="entry-net">
              {validation.net === null ? "—" : formatMinutes(validation.net)}
            </p>
            <p className="num mt-1 font-mono text-tiny text-fg-3">
              {validation.gross === null ? "Check the times" : `${formatMinutes(validation.gross)} gross`}
            </p>
          </div>
        </div>

        <Field label="Description" htmlFor="entry-description" hint="Optional">
          <TextArea
            id="entry-description"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        {projectLocked && (
          <InlineAlert tone="info">
            This is the project’s first entry, so its original estimates will lock as the baseline.
          </InlineAlert>
        )}
        {saveError && <InlineAlert>{saveError}</InlineAlert>}
      </div>
    </Dialog>
  );
}
