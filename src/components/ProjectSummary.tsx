"use client";

import { Lock, LockOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import { buildProjectSummary, variancePercent, type ModeMinutes, type SummaryRow } from "@/lib/domain/calculations";
import { formatDate, formatPercentVariance, formatSignedMinutes } from "@/lib/domain/format";
import { WORK_MODES, WORK_MODE_INFO } from "@/lib/domain/psp";
import type { AppData, Project } from "@/lib/domain/types";
import { setOriginalEstimate, setRevisedEstimate } from "@/lib/state/actions";
import { run } from "@/lib/state/store";
import { EstimateEditor } from "./EstimateEditor";
import { ModeGlyph, cx } from "./ui";

/**
 * Planned-versus-actual comparison for one project. Actuals are always derived
 * from saved entries. Originals are editable until tracking starts; revisions after.
 */
export function ProjectSummary({ project, data }: { project: Project; data: AppData }) {
  const [showModes, setShowModes] = useState(false);
  const summary = buildProjectSummary(project.id, data.estimates, data.entries);
  const locked = project.baselineLockedAt !== null;
  const active = project.status === "active";
  const canEditOriginal = active && !locked;
  const canEditRevised = active && locked;

  function commitOriginal(row: SummaryRow, minutes: number | null) {
    const result = run((d) => setOriginalEstimate(d, project.id, row.phase, minutes ?? 0, new Date().toISOString()));
    return result.ok ? undefined : result.error;
  }
  function commitRevised(row: SummaryRow, minutes: number | null) {
    const result = run((d) => setRevisedEstimate(d, project.id, row.phase, minutes, new Date().toISOString()));
    return result.ok ? undefined : result.error;
  }

  const original = (row: SummaryRow) =>
    canEditOriginal ? (
      <EstimateEditor
        key={`o-${row.original}`}
        value={row.original}
        label={`${row.phase} original estimate, minutes`}
        onCommit={(m) => commitOriginal(row, m)}
      />
    ) : (
      <span className="num text-fg-2">{row.original}</span>
    );

  const revised = (row: SummaryRow) =>
    canEditRevised ? (
      <EstimateEditor
        key={`r-${row.revised}`}
        value={row.revised}
        allowEmpty
        placeholder="—"
        label={`${row.phase} revised estimate, minutes (leave empty for none)`}
        onCommit={(m) => commitRevised(row, m)}
      />
    ) : (
      <span className="num text-fg-3">{row.revised ?? "—"}</span>
    );

  const totals = summary.totals;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 pb-4">
        <p className="flex items-start gap-2 text-meta text-fg-2">
          {locked ? (
            <>
              <Lock className="mt-px size-3.5 shrink-0 text-fg-3" aria-hidden />
              <span>
                Baseline locked {formatDate(project.baselineLockedAt!)}.
                {canEditRevised && " Re-forecast in the Revised column; originals stay fixed."}
              </span>
            </>
          ) : (
            <>
              <LockOpen className="mt-px size-3.5 shrink-0 text-fg-3" aria-hidden />
              <span>Original estimates are editable until the first time entry is saved.</span>
            </>
          )}
        </p>
        <button
          type="button"
          aria-pressed={showModes}
          onClick={() => setShowModes((v) => !v)}
          className={cx(
            "inline-flex h-9 items-center gap-2 rounded-sm border px-3 text-meta transition-colors",
            showModes ? "border-fg bg-surface text-fg" : "border-border text-fg-2 hover:text-fg",
          )}
        >
          <span aria-hidden className={cx("grid size-3 place-items-center border", showModes ? "border-fg bg-fg" : "border-fg-3")}>
            {showModes && <span className="size-1.5 bg-canvas" />}
          </span>
          Split by work mode
        </button>
      </div>

      {/* Desktop: aligned numeric columns */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-body">
          <caption className="sr-only">Planned versus actual minutes by phase</caption>
          <thead>
            <tr className="border-y border-hairline text-left">
              <th scope="col" className="micro py-3 pr-4 font-medium">Phase</th>
              <Th>Original</Th>
              <Th>Revised</Th>
              <Th strong>Actual</Th>
              {showModes &&
                WORK_MODES.map((m) => (
                  <Th key={m}>
                    <span className="inline-flex items-center gap-1.5">
                      <ModeGlyph mode={m} className="size-2" />
                      {WORK_MODE_INFO[m].short}
                    </span>
                  </Th>
                ))}
              <Th divider>Δ Original</Th>
              <Th>%</Th>
              <Th divider>Δ Revised</Th>
              <Th last>%</Th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr key={row.phase} className="border-b border-hairline transition-colors hover:bg-hover">
                <th scope="row" className="py-2.5 pr-4 text-left font-normal whitespace-nowrap text-fg">
                  {row.phase}
                </th>
                <Td>{original(row)}</Td>
                <Td>{revised(row)}</Td>
                <Td>
                  <span className="num font-medium text-fg">{row.actual}</span>
                </Td>
                {showModes && <ModeCells byMode={row.byMode} />}
                <VarianceCells actual={row.actual} estimate={row.original} />
                {row.revised === null ? <EmptyVariance /> : <VarianceCells actual={row.actual} estimate={row.revised} last />}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-fg-3">
              <th scope="row" className="py-3.5 pr-4 text-left font-semibold text-fg">Total</th>
              <Td>
                <span className="num font-medium text-fg">{totals.original}</span>
              </Td>
              <Td>
                <span className="num text-fg-2" title={totals.revised !== null ? "Revised where set, original elsewhere" : undefined}>
                  {totals.revised ?? "—"}
                  {totals.revised !== null && "*"}
                </span>
              </Td>
              <Td>
                <span className="num font-semibold text-fg">{totals.actual}</span>
              </Td>
              {showModes && <ModeCells byMode={totals.byMode} strong />}
              <VarianceCells actual={totals.actual} estimate={totals.original} strong />
              {totals.revised === null ? (
                <EmptyVariance />
              ) : (
                <VarianceCells actual={totals.actual} estimate={totals.revised} last strong />
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phones and narrow windows: one grouped row per phase */}
      <ul className="border-t border-hairline lg:hidden">
        {summary.rows.map((row) => (
          <li key={row.phase} className="border-b border-hairline py-4">
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-lead text-fg">{row.phase}</span>
              <span className="num text-lead font-medium text-fg">
                {row.actual}
                <span className="ml-1 text-meta font-normal text-fg-3">min</span>
              </span>
            </div>
            <div className="mt-3 grid grid-cols-[72px_72px_1fr] items-end gap-x-4">
              <MobileField label="Original">{original(row)}</MobileField>
              <MobileField label="Revised">{revised(row)}</MobileField>
              <div className="text-right">
                <MobileVariance actual={row.actual} estimate={row.original} label="vs original" />
                {row.revised !== null && (
                  <MobileVariance actual={row.actual} estimate={row.revised} label="vs revised" />
                )}
              </div>
            </div>
            {showModes && <MobileModes byMode={row.byMode} />}
          </li>
        ))}
        <li className="py-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-lead font-semibold text-fg">Total</span>
            <span className="num text-lead font-semibold text-fg">
              {totals.actual}
              <span className="ml-1 text-meta font-normal text-fg-3">min</span>
            </span>
          </div>
          <div className="mt-3 grid grid-cols-[72px_72px_1fr] items-end gap-x-4">
            <MobileField label="Original">
              <span className="num font-medium">{totals.original}</span>
            </MobileField>
            <MobileField label="Revised*">
              <span className="num text-fg-2">{totals.revised ?? "—"}</span>
            </MobileField>
            <div className="text-right">
              <MobileVariance actual={totals.actual} estimate={totals.original} label="vs original" />
              {totals.revised !== null && (
                <MobileVariance actual={totals.actual} estimate={totals.revised} label="vs revised" />
              )}
            </div>
          </div>
          {showModes && <MobileModes byMode={totals.byMode} />}
        </li>
      </ul>

      <p className="mt-4 max-w-2xl text-meta leading-relaxed text-fg-3">
        All values in minutes. Δ is actual − estimate: positive means over, negative under.
        {totals.revised !== null && " *Total revised counts the original estimate for phases that were not revised."}
        {showModes && " Work-mode columns split each phase’s actual and always add up to it."}
      </p>
    </div>
  );
}

function Th({ children, last, divider, strong }: { children: ReactNode; last?: boolean; divider?: boolean; strong?: boolean }) {
  return (
    <th
      scope="col"
      className={cx(
        "micro px-3 py-3 text-right font-medium whitespace-nowrap",
        divider && "pl-6",
        last && "pr-0",
        strong && "text-fg-2",
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, last }: { children: ReactNode; last?: boolean }) {
  return <td className={cx("px-3 py-2 text-right whitespace-nowrap", last && "pr-0")}>{children}</td>;
}

/** Over-estimate values are set in full-strength text, under in secondary. The sign carries the meaning. */
function toneFor(diff: number, strong?: boolean) {
  if (strong) return "text-fg font-semibold";
  return diff > 0 ? "text-fg" : "text-fg-2";
}

function VarianceCells({ actual, estimate, last, strong }: { actual: number; estimate: number; last?: boolean; strong?: boolean }) {
  const diff = actual - estimate;
  const pct = variancePercent(actual, estimate);
  return (
    <>
      <td className={cx("num py-2 pr-3 pl-6 text-right whitespace-nowrap", toneFor(diff, strong))}>
        {formatSignedMinutes(diff)}
      </td>
      <td
        className={cx(
          "num px-3 py-2 text-right whitespace-nowrap",
          pct.kind === "unestimated" ? "font-sans text-meta text-fg" : toneFor(diff, strong),
          last && "pr-0",
        )}
      >
        {formatPercentVariance(pct)}
      </td>
    </>
  );
}

function EmptyVariance() {
  return (
    <>
      <td className="num py-2 pr-3 pl-6 text-right text-fg-4">—</td>
      <td className="num py-2 pr-0 pl-3 text-right text-fg-4">—</td>
    </>
  );
}

function ModeCells({ byMode, strong }: { byMode: ModeMinutes; strong?: boolean }) {
  return (
    <>
      {WORK_MODES.map((m) => (
        <td key={m} className={cx("num px-3 py-2 text-right whitespace-nowrap", strong ? "text-fg-2" : "text-fg-3")}>
          {byMode[m]}
        </td>
      ))}
    </>
  );
}

function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="micro">{label}</span>
      <span className="flex h-9 items-end text-body">{children}</span>
    </div>
  );
}

function MobileVariance({ actual, estimate, label }: { actual: number; estimate: number; label: string }) {
  const diff = actual - estimate;
  const pct = variancePercent(actual, estimate);
  return (
    <p className="num text-meta leading-6">
      <span className="text-fg-3">{label} </span>
      <span className={toneFor(diff)}>
        {formatSignedMinutes(diff)} · {formatPercentVariance(pct)}
      </span>
    </p>
  );
}

function MobileModes({ byMode }: { byMode: ModeMinutes }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
      {WORK_MODES.map((m) => (
        <span key={m} className="num inline-flex items-center gap-1.5 text-meta text-fg-3">
          <ModeGlyph mode={m} className="size-2" />
          {WORK_MODE_INFO[m].short}
          <span className="text-fg-2">{byMode[m]}</span>
        </span>
      ))}
    </div>
  );
}
