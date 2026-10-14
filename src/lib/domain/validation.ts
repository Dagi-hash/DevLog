import { grossMinutesBetween } from './calculations';
import { isPhase, isWorkMode } from './psp';

export interface EntryDraft {
  projectId: string;
  phase: string;
  workMode: string;
  startedAt: string; // ISO
  endedAt: string; // ISO
  /** Raw text from the input so we can reject "1.5", "-2", "abc". */
  interruption: string;
}

export type EntryField = 'projectId' | 'phase' | 'workMode' | 'startedAt' | 'endedAt' | 'interruption';

export interface EntryValidation {
  errors: Partial<Record<EntryField, string>>;
  gross: number | null;
  interruptionMinutes: number | null;
  net: number | null;
}

export const INTERRUPTION_TOO_LARGE = 'Interruption time cannot exceed total elapsed time.';

/** Parses a non-negative whole number; returns null for anything else. */
export function parseWholeMinutes(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return 0;
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : null;
}

export function validateEntry(draft: EntryDraft): EntryValidation {
  const errors: EntryValidation['errors'] = {};
  if (!draft.projectId) errors.projectId = 'Choose a project.';
  if (!isPhase(draft.phase)) errors.phase = 'Choose a phase.';
  if (!isWorkMode(draft.workMode)) errors.workMode = 'Choose a work mode.';

  const start = Date.parse(draft.startedAt);
  const end = Date.parse(draft.endedAt);
  if (!Number.isFinite(start)) errors.startedAt = 'Enter a valid start date and time.';
  if (!Number.isFinite(end)) errors.endedAt = 'Enter a valid end date and time.';

  let gross: number | null = null;
  if (Number.isFinite(start) && Number.isFinite(end)) {
    if (end < start) errors.endedAt = 'End must be at or after the start.';
    else gross = grossMinutesBetween(start, end);
  }

  const interruptionMinutes = parseWholeMinutes(draft.interruption);
  if (interruptionMinutes === null) {
    errors.interruption = 'Use a whole number of minutes, 0 or more.';
  } else if (gross !== null && interruptionMinutes > gross) {
    errors.interruption = INTERRUPTION_TOO_LARGE;
  }

  const net =
    gross !== null && interruptionMinutes !== null && interruptionMinutes <= gross
      ? gross - interruptionMinutes
      : null;

  return { errors, gross, interruptionMinutes, net };
}

export function isValid(v: EntryValidation): boolean {
  return Object.keys(v.errors).length === 0;
}

export function parseEstimate(raw: string): number | null {
  return parseWholeMinutes(raw);
}
