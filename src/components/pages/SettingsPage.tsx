"use client";

import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { PHASES, WORK_MODES, WORK_MODE_INFO } from "@/lib/domain/psp";
import { STORAGE_KEY } from "@/lib/storage/persistence";
import { resetToDemoData, useStoreState } from "@/lib/state/store";
import { ConfirmDialog } from "../ConfirmDialog";
import { Button, InlineAlert, ModeDot, SectionHeading } from "../ui";

export function SettingsPage() {
  const state = useStoreState();
  const [confirming, setConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  if (!state) return null;
  const { data, persistent } = state;

  return (
    <>
      <header>
        <h1 className="text-[24px] font-semibold tracking-tight text-fg sm:text-[28px]">Settings</h1>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="data-heading">
          <SectionHeading id="data-heading" title="Data" />
          <div className="rounded-lg border border-line bg-surface">
            <div className="space-y-3 px-5 py-4 text-[14px] leading-relaxed text-fg-2">
              <p>
                This is a local prototype. Everything is saved in this browser’s local storage
                {persistent ? "" : " (currently unavailable, so changes last only until the page closes)"}. Nothing is
                sent to a server, and nothing is synced between your Mac and iPhone.
              </p>
              <dl className="num grid grid-cols-3 gap-3 pt-1">
                <Count label="Projects" value={data.projects.length} />
                <Count label="Entries" value={data.entries.length} />
                <Count label="Timer" value={data.activeTimer ? "Running" : "Idle"} />
              </dl>
              <p className="text-[12.5px] text-fg-3">
                Storage key <code className="font-mono text-fg-2">{STORAGE_KEY}</code>
              </p>
            </div>
            <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[14px] font-medium text-fg">Reset demo data</p>
                <p className="text-[13px] text-fg-3">Replace everything here with the original sample projects.</p>
              </div>
              <Button variant="danger" onClick={() => setConfirming(true)}>
                <RotateCcw />
                Reset…
              </Button>
            </div>
          </div>
          {resetDone && (
            <div className="mt-3">
              <InlineAlert tone="info">Demo data restored.</InlineAlert>
            </div>
          )}
        </section>

        <section aria-labelledby="reference-heading">
          <SectionHeading id="reference-heading" title="Reference" />
          <div className="divide-y divide-line rounded-lg border border-line bg-surface">
            <div className="px-5 py-4">
              <p className="text-[14px] font-medium text-fg">Work modes</p>
              <p className="mt-1 text-[13px] text-fg-3">
                Metadata on each entry, not a phase. Record your own active work and supervision, never unattended agent
                runtime.
              </p>
              <ul className="mt-3 space-y-2.5">
                {WORK_MODES.map((m) => (
                  <li key={m} className="text-[13.5px] leading-snug">
                    <span className="inline-flex items-center gap-2 font-medium text-fg">
                      <ModeDot mode={m} />
                      {WORK_MODE_INFO[m].label}
                    </span>
                    <span className="mt-0.5 block pl-3.5 text-fg-2">{WORK_MODE_INFO[m].description}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-5 py-4">
              <p className="flex items-center gap-2 text-[14px] font-medium text-fg">
                PSP phases
                <span className="rounded-full bg-over-soft px-2 py-0.5 text-[11px] font-medium text-over">Provisional</span>
              </p>
              <p className="mt-1 text-[13px] text-fg-3">To be verified against the course materials.</p>
              <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[13.5px] text-fg-2">
                {PHASES.map((p, i) => (
                  <li key={p} className="num">
                    <span className="mr-2 text-fg-3">{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ol>
            </div>
            <div className="px-5 py-4 text-[13px] leading-relaxed text-fg-3">
              Durations round half-up to whole minutes (30 s → 1 min), then interruptions are subtracted. Variance is
              actual − estimate; percentages are relative to the estimate.
            </div>
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Reset to demo data?"
        description={
          <>
            All {data.projects.length} projects and {data.entries.length} entries in this browser
            {data.activeTimer ? ", including the running timer," : ""} will be replaced by the sample data. This can’t be
            undone.
          </>
        }
        confirmLabel="Reset demo data"
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          const result = resetToDemoData();
          if (!result.ok) return result.error;
          setResetDone(true);
        }}
      />
    </>
  );
}

function Count({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[12px] text-fg-3">{label}</dt>
      <dd className="mt-0.5 text-[16px] font-semibold text-fg">{value}</dd>
    </div>
  );
}
