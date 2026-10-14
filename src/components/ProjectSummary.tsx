"use client";

import { Lock, LockOpen } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  buildProjectSummary,
  variancePercent,
  type ModeMinutes,
  type SummaryRow,
} from "@/lib/domain/calculations";
import { formatDate, formatPercentVariance, formatSignedMinutes } from "@/lib/domain/format";
import { WORK_MODES, WORK_MODE_INFO } from "@/lib/domain/psp";
import type { AppData, Project } from "@/lib/domain/types";
import { setOriginalEstimate, setRevisedEstimate } from "@/lib/state/actions";
import { run } from "@/lib/state/store";
import { EstimateEditor } from "./EstimateEditor";
import { ModeDot, cx } from "./ui";

/**
 * Planned-versus-actual table for one project. Actuals are always derived from
 * saved entries. Originals are editable until tracking starts; revisions after.
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
      <span className="num">{row.original}</span>
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
      <span className="num text-fg-2">{row.revised ?? "—"}</span>
    );

  const totals = summary.totals;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex items-center gap-2 text-[13px] text-fg-2">
          {locked ? (
            <>
              <Lock className="size-3.5 text-fg-3" aria-hidden />
              <span>
                Baseline locked {formatDate(project.baselineLockedAt!)}.
                {canEditRevised && " Re-forecast in the Revised column."}
              </span>
            </>
          ) : (
            <>
              <LockOpen className="size-3.5 text-fg-3" aria-hidden />
              <span>Original estimates are editable until the first time entry is saved.</span>
            </>
          )}
        </p>
        <button
          type="button"
          aria-pressed={showModes}
          onClick={() => setShowModes((v) => !v)}
          className={cx(
            "h-8 rounded-sm border px-2.5 text-[12.5px] font-medium transition-colors",
            showModes ? "border-accent/50 bg-accent-soft text-fg" : "border-line text-fg-2 hover:text-fg",
          )}
        >
          By work mode
        </button>
      </div>

      {/* Desktop / tablet: full table */}
      <div className="hidden overflow-x-auto rounded-lg border border-line lg:block">
        <table className="w-full text-[13.5px]">
          <caption className="sr-only">Planned versus actual minutes by phase</caption>
          <thead>
            <tr className="border-b border-line bg-surface text-left text-[12px] font-medium text-fg-3">
              <th scope="col" className="py-2.5 pr-3 pl-4 font-medium">Phase</th>
              <Th>Original</Th>
              <Th>Revised</Th>
              <Th>Actual</Th>
              {showModes &&
                WORK_MODES.map((m) => (
                  <Th key={m}>
                    <span className="inline-flex items-center gap-1.5">
                      <ModeDot mode={m} />
                      {WORK_MODE_INFO[m].short}
                    </span>
                  </Th>
                ))}
              <Th>Var vs orig</Th>
              <Th>%</Th>
              <Th>Var vs rev</Th>
              <Th last>%</Th>
            </tr>
          </thead>
          <tbody>
            {summary.rows.map((row) => (
              <tr key={row.phase} className="border-b border-line last:border-b-0 hover:bg-white/[0.015]">
                <th scope="row" className="py-2 pr-3 pl-4 text-left font-medium whitespace-nowrap text-fg">
                  {row.phase}
                </th>
                <Td>{original(row)}</Td>
                <Td>{revised(row)}</Td>
                <Td strong>{row.actual}</Td>
                {showModes && <ModeCells byMode={row.byMode} />}
                <VarianceCells actual={row.actual} estimate={row.original} />
                {row.revised === null ? (
                  <>
                    <Td muted>—</Td>
                    <Td muted last>—</Td>
                  </>
                ) : (
                  <VarianceCells actual={row.actual} estimate={row.revised} last />
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-line-strong bg-surface font-semibold">
              <th scope="row" className="py-2.5 pr-3 pl-4 text-left text-fg">Total</th>
              <Td strong>{totals.original}</Td>
              <Td>
                <span className="num text-fg-2" title={totals.revised !== null ? "Revised where set, original elsewhere" : undefined}>
                  {totals.revised ?? "—"}
                  {totals.revised !== null && <span className="text-fg-3">*</span>}
                </span>
              </Td>
              <Td strong>{totals.actual}</Td>
              {showModes && <ModeCells byMode={totals.byMode} />}
              <VarianceCells actual={totals.actual} estimate={totals.original} />
              {totals.revised === null ? (
                <>
                  <Td muted>—</Td>
                  <Td muted last>—</Td>
                </>
              ) : (
                <VarianceCells actual={totals.actual} estimate={totals.revised} last />
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Phones: one compact block per phase */}
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line lg:hidden">
        {summary.rows.map((row) => (
          <li key={row.phase} className="px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[14.5px] font-medium text-fg">{row.phase}</span>
              <span className="num shrink-0 text-[14.5px] font-semibold text-fg">{row.actual} min</span>
            </div>
            <div className="mt-2 grid grid-cols-[auto_auto_1fr] items-center gap-x-4 gap-y-1">
              <MobileLabel>Original</MobileLabel>
              <MobileLabel>Revised</MobileLabel>
              <MobileLabel right>Variance</MobileLabel>
              <div className="text-[14px]">{original(row)}</div>
              <div className="text-[14px]">{revised(row)}</div>
              <div className="text-right">
                <MobileVariance actual={row.actual} estimate={row.original} />
                {row.revised !== null && (
                  <div className="mt-0.5">
                    <MobileVariance actual={row.actual} estimate={row.revised} prefix="rev " />
                  </div>
                )}
              </div>
            </div>
            {showModes && <MobileModes byMode={row.byMode} />}
          </li>
        ))}
        <li className="bg-surface px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[14.5px] font-semibold text-fg">Total</span>
            <span className="num text-[14.5px] font-semibold text-fg">{totals.actual} min</span>
          </div>
          <div className="mt-2 grid grid-cols-[auto_auto_1fr] items-center gap-x-4 gap-y-1">
            <MobileLabel>Original</MobileLabel>
            <MobileLabel>Revised*</MobileLabel>
            <MobileLabel right>Variance</MobileLabel>
            <span className="num text-[14px] font-semibold">{totals.original}</span>
            <span className="num text-[14px] text-fg-2">{totals.revised ?? "—"}</span>
            <div className="text-right">
              <MobileVariance actual={totals.actual} estimate={totals.original} />
              {totals.revised !== null && (
                <div className="mt-0.5">
                  <MobileVariance actual={totals.actual} estimate={totals.revised} prefix="rev " />
                </div>
              )}
            </div>
          </div>
          {showModes && <MobileModes byMode={totals.byMode} />}
        </li>
      </ul>

      <p className="mt-2.5 text-[12px] leading-relaxed text-fg-3">
        Minutes. Variance = actual − estimate; positive means over.
        {totals.revised !== null && " *Total revised uses the original where a phase has no revision."}
        {showModes && " Work-mode columns split each phase’s actual; they always add up to it."}
      </p>
    </div>
  );
}

function Th({ children, last }: { children: ReactNode; last?: boolean }) {
  return (
    <th scope="col" className={cx("px-3 py-2.5 text-right font-medium whitespace-nowrap", last && "pr-4")}>
      {children}
    </th>
  );
}

function Td({ children, strong, muted, last }: { children: ReactNode; strong?: boolean; muted?: boolean; last?: boolean }) {
  return (
    <td
      className={cx(
        "num px-3 py-2 text-right whitespace-nowrap",
        strong ? "font-semibold text-fg" : muted ? "text-fg-3" : "text-fg-2",
        last && "pr-4",
      )}
    >
      {children}
    </td>
  );
}

function toneFor(diff: number) {
  return diff > 0 ? "text-over" : diff < 0 ? "text-under" : "text-fg-2";
}

function VarianceCells({ actual, estimate, last }: { actual: number; estimate: number; last?: boolean }) {
  const diff = actual - estimate;
  const pct = variancePercent(actual, estimate);
  return (
    <>
      <td className={cx("num px-3 py-2 text-right whitespace-nowrap", toneFor(diff))}>{formatSignedMinutes(diff)}</td>
      <td
        className={cx(
          "num px-3 py-2 text-right whitespace-nowrap",
          pct.kind === "unestimated" ? "text-[12.5px] text-over" : toneFor(diff),
          last && "pr-4",
        )}
      >
        {formatPercentVariance(pct)}
      </td>
    </>
  );
}

function ModeCells({ byMode }: { byMode: ModeMinutes }) {
  return (
    <>
      {WORK_MODES.map((m) => (
        <td key={m} className="num px-3 py-2 text-right whitespace-nowrap text-fg-3">
          {byMode[m]}
        </td>
      ))}
    </>
  );
}

function MobileLabel({ children, right }: { children: ReactNode; right?: boolean }) {
  return <span className={cx("text-[11.5px] text-fg-3", right && "text-right")}>{children}</span>;
}

function MobileVariance({ actual, estimate, prefix = "" }: { actual: number; estimate: number; prefix?: string }) {
  const diff = actual - estimate;
  const pct = variancePercent(actual, estimate);
  return (
    <span className={cx("num text-[13px]", pct.kind === "unestimated" ? "text-over" : toneFor(diff))}>
      <span className="text-fg-3">{prefix}</span>
      {formatSignedMinutes(diff)} · {formatPercentVariance(pct)}
    </span>
  );
}

function MobileModes({ byMode }: { byMode: ModeMinutes }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
      {WORK_MODES.map((m) => (
        <span key={m} className="num inline-flex items-center gap-1.5 text-[12.5px] text-fg-3">
          <ModeDot mode={m} />
          {WORK_MODE_INFO[m].short} {byMode[m]}
        </span>
      ))}
    </div>
  );
}
