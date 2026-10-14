/**
 * localStorage persistence: one versioned JSON document.
 *
 * Loading never throws. Missing data seeds the demo; unreadable data is kept
 * under a backup key and replaced by the demo; individual invalid records are
 * dropped so they cannot corrupt totals.
 */
import { PHASES, isPhase, isProjectStatus, isWorkMode } from '../domain/psp';
import type { ActiveTimer, AppData, PhaseEstimate, Project, TimeEntry } from '../domain/types';
import { grossMinutesBetween } from '../domain/calculations';
import { createDemoData } from './demoData';

export const STORAGE_KEY = 'devlog';
/** Keys used by earlier builds (the app was called PSP Workbench); migrated on first load. */
export const LEGACY_STORAGE_KEYS = ['psp-workbench'];
export const SCHEMA_VERSION = 1;

interface StoredDocument {
  version: number;
  savedAt: string;
  data: AppData;
}

export interface LoadResult {
  data: AppData;
  /** Human-readable note when something unusual happened during load. */
  issue: string | null;
  /** False when localStorage cannot be used at all (data lives in memory only). */
  persistent: boolean;
}

export function getStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_KEY}:probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

export function saveAppData(storage: Storage | null, data: AppData): void {
  if (!storage) return;
  const doc: StoredDocument = { version: SCHEMA_VERSION, savedAt: new Date().toISOString(), data };
  storage.setItem(STORAGE_KEY, JSON.stringify(doc));
}

export function loadAppData(storage: Storage | null, now: Date = new Date()): LoadResult {
  if (!storage) {
    return {
      data: createDemoData(now),
      issue: 'This browser is blocking local storage, so changes will be lost when the page closes.',
      persistent: false,
    };
  }

  let raw = storage.getItem(STORAGE_KEY);
  if (raw === null) raw = migrateLegacy(storage);
  if (raw === null) {
    const data = createDemoData(now);
    trySave(storage, data);
    return { data, issue: null, persistent: true };
  }

  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    return recoverFromUnreadable(storage, raw, now);
  }
  if (!isRecord(doc) || doc.version !== SCHEMA_VERSION || !isRecord(doc.data)) {
    return recoverFromUnreadable(storage, raw, now);
  }

  const { data, dropped } = sanitize(doc.data);
  const issue =
    dropped > 0
      ? `${dropped} invalid record${dropped === 1 ? ' was' : 's were'} skipped while loading saved data.`
      : null;
  if (dropped > 0) trySave(storage, data);
  return { data, issue, persistent: true };
}

/** Moves data saved under an old key to the current one. Returns the raw document, if any. */
function migrateLegacy(storage: Storage): string | null {
  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = storage.getItem(key);
    if (legacy === null) continue;
    try {
      storage.setItem(STORAGE_KEY, legacy);
      storage.removeItem(key);
    } catch {
      // Still usable for this session; migration retries on the next load.
    }
    return legacy;
  }
  return null;
}

function recoverFromUnreadable(storage: Storage, raw: string, now: Date): LoadResult {
  const backupKey = `${STORAGE_KEY}:unreadable:${now.toISOString()}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    // Backup is best effort.
  }
  const data = createDemoData(now);
  trySave(storage, data);
  return {
    data,
    issue: `Saved data could not be read, so demo data was loaded. The original was kept in localStorage under "${backupKey}".`,
    persistent: true,
  };
}

function trySave(storage: Storage, data: AppData) {
  try {
    saveAppData(storage, data);
  } catch {
    // Surfaced on the next user-initiated save.
  }
}

// ---------------------------------------------------------------------------
// Validation of stored records
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isIso(v: unknown): v is string {
  return isString(v) && Number.isFinite(Date.parse(v));
}

function isWholeMinutes(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export function sanitize(input: Record<string, unknown>): { data: AppData; dropped: number } {
  let dropped = 0;

  const projects: Project[] = [];
  for (const p of asArray(input.projects)) {
    if (
      isRecord(p) &&
      isString(p.id) &&
      isString(p.name) &&
      p.name.trim() !== '' &&
      isProjectStatus(p.status) &&
      isIso(p.createdAt) &&
      isIso(p.updatedAt) &&
      (p.baselineLockedAt === null || isIso(p.baselineLockedAt)) &&
      !projects.some((x) => x.id === p.id)
    ) {
      projects.push({
        id: p.id,
        name: p.name,
        description: isString(p.description) ? p.description : '',
        status: p.status,
        baselineLockedAt: p.baselineLockedAt,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      });
    } else dropped++;
  }
  const projectIds = new Set(projects.map((p) => p.id));

  // Exactly one estimate row per project and phase; fill any gaps with zero.
  const estimates: PhaseEstimate[] = [];
  const stored = asArray(input.estimates);
  for (const project of projects) {
    for (const phase of PHASES) {
      const match = stored.find(
        (e): e is Record<string, unknown> => isRecord(e) && e.projectId === project.id && e.phase === phase,
      );
      const original = match && isWholeMinutes(match.originalMinutes) ? match.originalMinutes : 0;
      const revised = match && isWholeMinutes(match.revisedMinutes) ? match.revisedMinutes : null;
      estimates.push({ projectId: project.id, phase, originalMinutes: original, revisedMinutes: revised });
    }
  }

  const entries: TimeEntry[] = [];
  for (const e of asArray(input.entries)) {
    if (
      isRecord(e) &&
      isString(e.id) &&
      (e.sessionId === null || isString(e.sessionId)) &&
      isString(e.projectId) &&
      projectIds.has(e.projectId) &&
      isPhase(e.phase) &&
      isWorkMode(e.workMode) &&
      isIso(e.startedAt) &&
      isIso(e.endedAt) &&
      Date.parse(e.endedAt) >= Date.parse(e.startedAt) &&
      isWholeMinutes(e.interruptionMinutes) &&
      e.interruptionMinutes <= grossMinutesBetween(e.startedAt, e.endedAt) &&
      isIso(e.createdAt) &&
      isIso(e.updatedAt) &&
      !entries.some((x) => x.id === e.id || (e.sessionId !== null && x.sessionId === e.sessionId))
    ) {
      entries.push({
        id: e.id,
        sessionId: e.sessionId,
        projectId: e.projectId,
        phase: e.phase,
        workMode: e.workMode,
        startedAt: e.startedAt,
        endedAt: e.endedAt,
        interruptionMinutes: e.interruptionMinutes,
        // Never trust a stored total: derive it from the timestamps.
        netMinutes: grossMinutesBetween(e.startedAt, e.endedAt) - e.interruptionMinutes,
        description: isString(e.description) ? e.description : '',
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      });
    } else dropped++;
  }

  let activeTimer: ActiveTimer | null = null;
  const t = input.activeTimer;
  if (t !== null && t !== undefined) {
    const project = isRecord(t) && isString(t.projectId) ? projects.find((p) => p.id === t.projectId) : undefined;
    if (
      isRecord(t) &&
      isString(t.sessionId) &&
      project &&
      isPhase(t.phase) &&
      isWorkMode(t.workMode) &&
      isIso(t.startedAt) &&
      !entries.some((e) => e.sessionId === t.sessionId)
    ) {
      activeTimer = {
        sessionId: t.sessionId,
        projectId: project.id,
        phase: t.phase,
        workMode: t.workMode,
        description: isString(t.description) ? t.description : '',
        startedAt: t.startedAt,
      };
    } else if (!(isRecord(t) && isString(t.sessionId) && entries.some((e) => e.sessionId === t.sessionId))) {
      // A timer whose entry was already saved is simply finished, not invalid.
      dropped++;
    }
  }

  return { data: { projects, estimates, entries, activeTimer }, dropped };
}
