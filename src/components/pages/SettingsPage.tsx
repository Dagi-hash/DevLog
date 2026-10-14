"use client";

import { RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { PHASES, WORK_MODES, WORK_MODE_INFO } from "@/lib/domain/psp";
import { STORAGE_KEY } from "@/lib/storage/persistence";
import { resetToDemoData, useStoreState } from "@/lib/state/store";
import { ConfirmDialog } from "../ConfirmDialog";
import { Button, InlineAlert, ModeGlyph, PageHeader } from "../ui";

export function SettingsPage() {
  const state = useStoreState();
  const [confirming, setConfirming] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  if (!state) return null;
  const { data, persistent } = state;

  return (
    <>
      <PageHeader eyebrow="Local prototype" title="Settings" />

      <div className="mt-10 max-w-3xl">
        <Section title="Data">
          <p className="max-w-xl text-body leading-relaxed text-fg-2">
            Everything is saved in this browser’s local storage
            {persistent ? "" : " — currently unavailable, so changes last only until the page closes"}. Nothing is sent
            to a server, and nothing is synced between your Mac and iPhone.
          </p>
          <dl className="mt-6 grid max-w-md grid-cols-3">
            <Count label="Projects" value={data.projects.length} />
            <Count label="Entries" value={data.entries.length} />
            <Count label="Timer" value={data.activeTimer ? "Running" : "Idle"} />
          </dl>
          <p className="mt-5 text-meta text-fg-3">
            Storage key <code className="text-fg-2">{STORAGE_KEY}</code>
          </p>
          <div className="mt-8 flex flex-col gap-4 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-body font-medium text-fg">Reset demo data</p>
              <p className="mt-0.5 text-meta text-fg-3">Replace everything in this browser with the original sample projects.</p>
            </div>
            <Button variant="destructive" onClick={() => setConfirming(true)}>
              <RotateCcw aria-hidden />
              Reset demo data…
            </Button>
          </div>
          {resetDone && (
            <div className="mt-4">
              <InlineAlert tone="info">Demo data restored.</InlineAlert>
            </div>
          )}
        </Section>

        <Section title="Work modes">
          <p className="mb-5 max-w-xl text-body text-fg-2">
            Metadata on each entry, not a phase. Record your own active work and supervision — never unattended agent runtime.
          </p>
          <dl>
            {WORK_MODES.map((m) => (
              <div key={m} className="grid gap-1 border-t border-hairline py-4 sm:grid-cols-[160px_1fr] sm:gap-8">
                <dt className="flex items-center gap-2 text-body font-medium text-fg">
                  <ModeGlyph mode={m} />
                  {WORK_MODE_INFO[m].label}
                </dt>
                <dd className="text-body text-fg-2">{WORK_MODE_INFO[m].description}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section title="PSP phases" aside="Provisional">
          <p className="mb-5 max-w-xl text-body text-fg-2">To be verified against the course materials.</p>
          <ol className="grid grid-cols-2 border-t border-hairline sm:grid-cols-4">
            {PHASES.map((p, i) => (
              <li key={p} className="flex items-baseline gap-3 border-b border-hairline py-3">
                <span className="num text-meta text-fg-3">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-body text-fg">{p}</span>
              </li>
            ))}
          </ol>
          <p className="mt-5 max-w-xl text-meta leading-relaxed text-fg-3">
            Durations round half-up to whole minutes (30 s → 1 min), then interruptions are subtracted. Variance is actual −
            estimate; percentages are relative to the estimate.
          </p>
        </Section>
      </div>

      <ConfirmDialog
        open={confirming}
        title="Reset to demo data?"
        description={
          <>
            All {data.projects.length} projects and {data.entries.length} entries in this browser
            {data.activeTimer ? ", including the running timer," : ""} will be replaced by the sample data. This can’t be undone.
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

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-hairline py-8 lg:grid-cols-[180px_1fr] lg:gap-12">
      <h2 className="flex items-center gap-3 text-body font-medium text-fg lg:flex-col lg:items-start lg:gap-2">
        {title}
        {aside && <span className="micro rounded-xs border border-border px-1.5 py-0.5">{aside}</span>}
      </h2>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Count({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="border-l border-hairline pl-4 first:border-l-0 first:pl-0">
      <dt className="text-meta text-fg-3">{label}</dt>
      <dd className="num mt-1 text-lead text-fg">{value}</dd>
    </div>
  );
}
