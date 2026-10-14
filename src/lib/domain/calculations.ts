import { PHASES, WORK_MODES, type Phase, type WorkMode } from './psp';
import type { PhaseEstimate, TimeEntry } from './types';

// ---------------------------------------------------------------------------
// Durations
// ---------------------------------------------------------------------------

/** Whole elapsed seconds between two timestamps (sub-second precision truncated, never negative). */
export function elapsedSeconds(startedAt: string | number, endedAt: string | number): number {
  const start = typeof startedAt === 'number' ? startedAt : Date.parse(startedAt);
  const end = typeof endedAt === 'number' ? endedAt : Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

/** Half-up rounding to whole minutes: 0–29 s → 0, 30–89 s → 1, 90–149 s → 2. */
export function grossMinutes(seconds: number): number {
  return Math.floor((Math.max(0, seconds) + 30) / 60);
}

export function grossMinutesBetween(startedAt: string | number, endedAt: string | number): number {
  return grossMinutes(elapsedSeconds(startedAt, endedAt));
}

export function netMinutes(gross: number, interruptionMinutes: number): number {
  return gross - interruptionMinutes;
}

// ---------------------------------------------------------------------------
// Variance
// ---------------------------------------------------------------------------

export type PercentVariance =
  | { kind: 'value'; value: number }
  | { kind: 'zero' } // estimate 0, actual 0
  | { kind: 'unestimated' }; // estimate 0, actual > 0

/** Positive = over the estimate, negative = under. */
export function varianceMinutes(actual: number, estimate: number): number {
  return actual - estimate;
}

export function variancePercent(actual: number, estimate: number): PercentVariance {
  if (estimate === 0) return actual === 0 ? { kind: 'zero' } : { kind: 'unestimated' };
  // Round to one decimal place, half away from zero.
  const raw = ((actual - estimate) / estimate) * 100;
  const rounded = (Math.sign(raw) * Math.round(Math.abs(raw) * 10)) / 10;
  return { kind: 'value', value: rounded === 0 ? 0 : rounded };
}

// ---------------------------------------------------------------------------
// Project summary (always derived from saved records)
// ---------------------------------------------------------------------------

export type ModeMinutes = Record<WorkMode, number>;

export interface SummaryRow {
  phase: Phase;
  original: number;
  revised: number | null;
  actual: number;
  byMode: ModeMinutes;
}

export interface SummaryTotals {
  original: number;
  /**
   * Total current forecast: revised where set, original elsewhere.
   * `null` when no phase has a revised estimate.
   */
  revised: number | null;
  actual: number;
  byMode: ModeMinutes;
}

export interface ProjectSummary {
  rows: SummaryRow[];
  totals: SummaryTotals;
}

export function emptyModeMinutes(): ModeMinutes {
  return { manual: 0, ai_assisted: 0, ai_agent: 0 };
}

export function buildProjectSummary(
  projectId: string,
  estimates: readonly PhaseEstimate[],
  entries: readonly TimeEntry[],
): ProjectSummary {
  const rows: SummaryRow[] = PHASES.map((phase) => {
    const estimate = estimates.find((e) => e.projectId === projectId && e.phase === phase);
    return {
      phase,
      original: estimate?.originalMinutes ?? 0,
      revised: estimate?.revisedMinutes ?? null,
      actual: 0,
      byMode: emptyModeMinutes(),
    };
  });

  for (const entry of entries) {
    if (entry.projectId !== projectId) continue;
    const row = rows.find((r) => r.phase === entry.phase);
    if (!row) continue;
    // Each entry counts once, under exactly one work mode.
    row.actual += entry.netMinutes;
    row.byMode[entry.workMode] += entry.netMinutes;
  }

  const totals: SummaryTotals = {
    original: 0,
    revised: rows.some((r) => r.revised !== null) ? 0 : null,
    actual: 0,
    byMode: emptyModeMinutes(),
  };
  for (const row of rows) {
    totals.original += row.original;
    totals.actual += row.actual;
    if (totals.revised !== null) totals.revised += row.revised ?? row.original;
    for (const mode of WORK_MODES) totals.byMode[mode] += row.byMode[mode];
  }

  return { rows, totals };
}

export function sumNetMinutes(entries: readonly TimeEntry[]): number {
  return entries.reduce((sum, e) => sum + e.netMinutes, 0);
}
