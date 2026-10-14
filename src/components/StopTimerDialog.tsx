"use client";

import { useRef, useState } from "react";
import { elapsedSeconds, grossMinutes } from "@/lib/domain/calculations";
import { formatClock, formatMinutes, formatTime } from "@/lib/domain/format";
import type { ActiveTimer } from "@/lib/domain/types";
import { INTERRUPTION_TOO_LARGE, parseWholeMinutes } from "@/lib/domain/validation";
import { createId, discardTimer, saveTimerEntry } from "@/lib/state/actions";
import { run } from "@/lib/state/store";
import { Dialog } from "./Dialog";
import { Button, Field, InlineAlert, ModeTag, TextArea, TextInput } from "./ui";

interface StopTimerDialogProps {
  timer: ActiveTimer | null;
  projectName: string;
  /** Moment Stop was pressed; the entry ends here, not when Save is clicked. */
  endedAtMs: number;
  /** Close without saving; the timer keeps running. */
  onKeepRunning: () => void;
  onDone: (outcome: "saved" | "discarded") => void;
}

export function StopTimerDialog(props: StopTimerDialogProps) {
  if (!props.timer) return null;
  return <StopTimerDialogInner {...props} timer={props.timer} />;
}

function StopTimerDialogInner({
  timer,
  projectName,
  endedAtMs,
  onKeepRunning,
  onDone,
}: StopTimerDialogProps & { timer: ActiveTimer }) {
  const [interruption, setInterruption] = useState("0");
  const [description, setDescription] = useState(timer.description);
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const savingRef = useRef(false);

  const seconds = elapsedSeconds(timer.startedAt, endedAtMs);
  const gross = grossMinutes(seconds);
  const parsed = parseWholeMinutes(interruption);
  const interruptionError =
    parsed === null
      ? "Use a whole number of minutes, 0 or more."
      : parsed > gross
        ? INTERRUPTION_TOO_LARGE
        : null;
  const net = parsed !== null && parsed <= gross ? gross - parsed : null;
  const nothingToRecord = gross === 0;

  function save() {
    setTouched(true);
    if (savingRef.current || interruptionError || nothingToRecord) return;
    savingRef.current = true;
    setSaving(true);
    const nowIso = new Date().toISOString();
    const result = run((data) =>
      saveTimerEntry(
        data,
        {
          sessionId: timer.sessionId,
          endedAt: new Date(endedAtMs).toISOString(),
          interruption,
          description,
        },
        nowIso,
        createId(),
      ),
    );
    if (!result.ok) {
      savingRef.current = false;
      setSaving(false);
      setSaveError(result.error);
      return;
    }
    onDone("saved");
  }

  function discard() {
    run((data) => discardTimer(data, timer.sessionId));
    onDone("discarded");
  }

  return (
    <Dialog
      open
      onClose={onKeepRunning}
      onSubmit={save}
      title="Save time entry"
      footer={
        <>
          <Button
            variant={confirmDiscard ? "destructive" : "ghost"}
            onClick={() => (confirmDiscard ? discard() : setConfirmDiscard(true))}
            className="sm:mr-auto"
          >
            <span aria-live="polite">{confirmDiscard ? "Confirm discard" : "Discard session"}</span>
          </Button>
          <Button onClick={onKeepRunning}>Keep running</Button>
          <Button type="submit" variant="primary" disabled={saving || nothingToRecord || (touched && !!interruptionError)}>
            {saving ? "Saving…" : "Save entry"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-lead font-medium break-words">{projectName}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body text-fg-2">
            <span className="text-fg">{timer.phase}</span>
            <span aria-hidden className="text-fg-4">/</span>
            <ModeTag mode={timer.workMode} className="text-body" />
          </p>
          <p className="num mt-1 font-mono text-meta text-fg-3">
            {formatTime(timer.startedAt)} – {formatTime(new Date(endedAtMs).toISOString())} · {formatClock(seconds)} elapsed
          </p>
        </div>

        <dl className="grid grid-cols-2 border-y border-border">
          <div className="py-4 pr-4">
            <dt className="micro">Gross</dt>
            <dd className="num mt-2 font-mono text-[28px] leading-none text-fg-2" data-testid="gross-minutes">
              {formatMinutes(gross)}
            </dd>
            <dd className="mt-1.5 text-meta text-fg-3">Rounded to the minute</dd>
          </div>
          <div className="border-l border-border py-4 pl-4">
            <dt className="micro text-fg-2">Net recorded</dt>
            <dd className="num mt-2 font-mono text-[28px] leading-none text-fg" data-testid="net-minutes">
              {net === null ? "—" : formatMinutes(net)}
            </dd>
            <dd className="mt-1.5 text-meta text-fg-3">Gross minus interruptions</dd>
          </div>
        </dl>

        {nothingToRecord && (
          <InlineAlert tone="info">Less than 30 seconds elapsed, which rounds to 0 minutes. Nothing to record.</InlineAlert>
        )}

        <Field
          label="Interruptions (minutes)"
          htmlFor="stop-interruption"
          error={touched ? (interruptionError ?? undefined) : undefined}
          hint="Time away from the work during this session."
        >
          <TextInput
            id="stop-interruption"
            data-autofocus
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={interruption}
            invalid={touched && !!interruptionError}
            aria-describedby={touched && interruptionError ? "stop-interruption-error" : undefined}
            onChange={(event) => {
              setInterruption(event.target.value);
              setTouched(true);
              setSaveError(null);
            }}
            onFocus={(event) => event.target.select()}
            className="num max-w-36 font-mono"
          />
        </Field>

        <Field label="Description" htmlFor="stop-description" hint="Optional">
          <TextArea
            id="stop-description"
            rows={2}
            maxLength={500}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        {saveError && <InlineAlert>{saveError}</InlineAlert>}
      </div>
    </Dialog>
  );
}
