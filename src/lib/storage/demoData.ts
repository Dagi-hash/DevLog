import { grossMinutesBetween } from '../domain/calculations';
import { PHASES, type Phase, type WorkMode } from '../domain/psp';
import type { AppData, PhaseEstimate, Project, TimeEntry } from '../domain/types';

type EstimatePlan = Record<Phase, [original: number, revised?: number]>;

interface EntrySpec {
  phase: Phase;
  mode: WorkMode;
  /** Days before today (0 = today). */
  daysAgo: number;
  /** Local start time "HH:MM" for past days; ignored for today. */
  at: string;
  minutes: number;
  interruption?: number;
  description?: string;
  /** Added after the fact rather than recorded with the timer. */
  manual?: boolean;
}

/**
 * Builds a realistic first-run dataset relative to `now`, so "Today" always has
 * something to show. Called only when no stored data exists or on explicit reset.
 */
export function createDemoData(now: Date = new Date()): AppData {
  const projects: Project[] = [];
  const estimates: PhaseEstimate[] = [];
  const entries: TimeEntry[] = [];
  let todayCursor = now.getTime() - 25 * 60_000; // today's demo work ends 25 min ago
  let entryCount = 0;

  function addProject(
    id: string,
    name: string,
    description: string,
    createdDaysAgo: number,
    status: Project['status'],
    plan: EstimatePlan,
    specs: EntrySpec[],
  ) {
    const created = new Date(now);
    created.setDate(created.getDate() - createdDaysAgo);
    created.setHours(8, 30, 0, 0);
    const createdAt = created.toISOString();

    for (const phase of PHASES) {
      const [original, revised] = plan[phase];
      estimates.push({ projectId: id, phase, originalMinutes: original, revisedMinutes: revised ?? null });
    }

    let lastActivity = createdAt;
    let firstStart: string | null = null;
    // Today's entries are laid out backwards from "now" so they never sit in the future.
    const today = specs.filter((s) => s.daysAgo === 0).reverse();
    const past = specs.filter((s) => s.daysAgo > 0);
    const built: TimeEntry[] = [];

    for (const spec of past) {
      const [h, m] = spec.at.split(':').map(Number);
      const start = new Date(now);
      start.setDate(start.getDate() - spec.daysAgo);
      start.setHours(h ?? 9, m ?? 0, 0, 0);
      built.push(makeEntry(id, spec, start.getTime()));
    }
    for (const spec of today) {
      const end = todayCursor;
      const start = end - (spec.minutes + (spec.interruption ?? 0)) * 60_000;
      todayCursor = start - 35 * 60_000;
      built.push(makeEntry(id, spec, start));
    }
    for (const entry of built) {
      entries.push(entry);
      if (entry.endedAt > lastActivity) lastActivity = entry.endedAt;
      if (!firstStart || entry.startedAt < firstStart) firstStart = entry.startedAt;
    }

    projects.push({
      id,
      name,
      description,
      status,
      baselineLockedAt: firstStart,
      createdAt,
      updatedAt: lastActivity,
    });
  }

  function makeEntry(projectId: string, spec: EntrySpec, startMs: number): TimeEntry {
    const interruption = spec.interruption ?? 0;
    const id = `${projectId}-entry-${++entryCount}`;
    const startedAt = new Date(startMs).toISOString();
    const endedAt = new Date(startMs + (spec.minutes + interruption) * 60_000).toISOString();
    return {
      id,
      sessionId: spec.manual ? null : `${id}-session`,
      projectId,
      phase: spec.phase,
      workMode: spec.mode,
      startedAt,
      endedAt,
      interruptionMinutes: interruption,
      netMinutes: grossMinutesBetween(startedAt, endedAt) - interruption,
      description: spec.description ?? '',
      targetMinutes: null,
      createdAt: endedAt,
      updatedAt: endedAt,
    };
  }

  addProject(
    'demo-workbench',
    'DevLog prototype',
    'Local-first timer and planned-vs-actual tracker for the PSP course.',
    6,
    'active',
    {
      Plan: [45],
      Design: [120],
      'Design Review': [30],
      Code: [240, 300],
      'Code Review': [45],
      Compile: [15],
      Test: [90, 120],
      Postmortem: [30],
    },
    [
      { phase: 'Plan', mode: 'manual', daysAgo: 5, at: '09:10', minutes: 50, interruption: 5, description: 'Scope, phase list and estimates' },
      { phase: 'Design', mode: 'manual', daysAgo: 4, at: '09:30', minutes: 95, description: 'Data model and timer state machine' },
      { phase: 'Design', mode: 'ai_assisted', daysAgo: 4, at: '13:15', minutes: 40, description: 'Explored persistence edge cases with chat' },
      { phase: 'Design Review', mode: 'manual', daysAgo: 3, at: '10:00', minutes: 25, description: 'Checklist review of the design', manual: true },
      { phase: 'Code', mode: 'ai_agent', daysAgo: 2, at: '09:00', minutes: 110, interruption: 10, description: 'Agent scaffolded storage layer; reviewed diffs' },
      { phase: 'Code', mode: 'ai_assisted', daysAgo: 1, at: '14:00', minutes: 85, description: 'Summary table and variance rules' },
      { phase: 'Code Review', mode: 'manual', daysAgo: 1, at: '16:20', minutes: 35 },
      { phase: 'Code', mode: 'ai_agent', daysAgo: 0, at: '', minutes: 45, description: 'Steered agent through stop-dialog validation' },
      { phase: 'Test', mode: 'ai_assisted', daysAgo: 0, at: '', minutes: 28, interruption: 4, description: 'Unit tests for rounding and variance' },
    ],
  );

  addProject(
    'demo-program-3a',
    'Program 3A — PROBE size estimator',
    'Linear regression over historical proxy size data.',
    3,
    'active',
    {
      Plan: [30],
      Design: [60],
      'Design Review': [20],
      Code: [120],
      'Code Review': [30],
      Compile: [10],
      Test: [60],
      Postmortem: [20],
    },
    [
      { phase: 'Plan', mode: 'manual', daysAgo: 3, at: '18:00', minutes: 35, description: 'Size estimate with PROBE method A' },
      { phase: 'Design', mode: 'manual', daysAgo: 2, at: '19:10', minutes: 48 },
      { phase: 'Design', mode: 'ai_assisted', daysAgo: 1, at: '19:30', minutes: 15, description: 'Checked regression formulas' },
      { phase: 'Design Review', mode: 'manual', daysAgo: 0, at: '', minutes: 22 },
    ],
  );

  addProject(
    'demo-program-2a',
    'Program 2A — LOC counter',
    'Counts logical lines of code per object and method.',
    12,
    'completed',
    {
      Plan: [20],
      Design: [45],
      'Design Review': [15],
      Code: [90],
      'Code Review': [20],
      Compile: [0],
      Test: [45],
      Postmortem: [15],
    },
    [
      { phase: 'Plan', mode: 'manual', daysAgo: 11, at: '09:00', minutes: 25 },
      { phase: 'Design', mode: 'manual', daysAgo: 11, at: '10:00', minutes: 38 },
      { phase: 'Design Review', mode: 'manual', daysAgo: 10, at: '09:00', minutes: 12 },
      { phase: 'Code', mode: 'manual', daysAgo: 10, at: '10:00', minutes: 104, interruption: 8 },
      { phase: 'Code Review', mode: 'manual', daysAgo: 9, at: '09:30', minutes: 18 },
      { phase: 'Compile', mode: 'manual', daysAgo: 9, at: '10:10', minutes: 6, description: 'Fixed two type errors' },
      { phase: 'Test', mode: 'ai_assisted', daysAgo: 9, at: '11:00', minutes: 52 },
      { phase: 'Postmortem', mode: 'manual', daysAgo: 8, at: '09:00', minutes: 14, manual: true },
    ],
  );

  return { projects, estimates, entries, activeTimer: null };
}
