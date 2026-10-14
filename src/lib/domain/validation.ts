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

/**
 * Parses a human duration into whole minutes: "45", "45m", "45 min", "1h", "1h30",
 * "1h 30m", "1:30", "1.5h". A bare number is minutes. Returns null when unreadable.
 */
export function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (s === '') return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+)(?:m|min|mins|minutes?)?$/))) return safe(Number(m[1]));
  if ((m = s.match(/^(\d+):([0-5]\d)$/))) return safe(Number(m[1]) * 60 + Number(m[2]));
  if ((m = s.match(/^(\d+(?:\.\d+)?)(?:h|hr|hrs|hours?)$/))) return safe(Math.round(Number(m[1]) * 60));
  if ((m = s.match(/^(\d+)(?:h|hr|hrs|hours?)(\d+)(?:m|min|mins|minutes?)?$/))) {
    return safe(Number(m[1]) * 60 + Number(m[2]));
  }
  return null;
}

function safe(value: number): number | null {
  return Number.isSafeInteger(value) ? value : null;
}

/** One minute of slack so a just-now end time never trips the future check. */
const FUTURE_SLACK_MS = 60_000;

export function validateEntry(draft: EntryDraft, options: { latestEndMs?: number } = {}): EntryValidation {
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
    if (options.latestEndMs !== undefined && end > options.latestEndMs + FUTURE_SLACK_MS) {
      errors.endedAt = 'That’s in the future. Log work once it’s done.';
    }
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
