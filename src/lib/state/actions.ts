/**
 * Pure state transitions. Each takes the current AppData and returns a new one,
 * or throws a DomainError with a user-facing message. No React, no storage.
 */
import { grossMinutesBetween } from '../domain/calculations';
import { PHASES, type Phase, type ProjectStatus, type WorkMode } from '../domain/psp';
import type { AppData, Project, TimeEntry } from '../domain/types';
import { INTERRUPTION_TOO_LARGE, isValid, validateEntry, type EntryDraft } from '../domain/validation';

export class DomainError extends Error {}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function findProject(data: AppData, projectId: string): Project {
  const project = data.projects.find((p) => p.id === projectId);
  if (!project) throw new DomainError('That project no longer exists.');
  return project;
}

function touchProject(data: AppData, projectId: string, nowIso: string, patch: Partial<Project> = {}): Project[] {
  return data.projects.map((p) => (p.id === projectId ? { ...p, ...patch, updatedAt: nowIso } : p));
}

function lockBaseline(projects: Project[], projectId: string, nowIso: string): Project[] {
  return projects.map((p) =>
    p.id === projectId && p.baselineLockedAt === null ? { ...p, baselineLockedAt: nowIso } : p,
  );
}

function cleanName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) throw new DomainError('Give the project a name.');
  if (trimmed.length > 120) throw new DomainError('Keep the name under 120 characters.');
  return trimmed;
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export function createProject(
  data: AppData,
  input: { name: string; description: string },
  nowIso: string,
  id: string = createId(),
): AppData {
  const project: Project = {
    id,
    name: cleanName(input.name),
    description: input.description.trim(),
    status: 'active',
    baselineLockedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return {
    ...data,
    projects: [...data.projects, project],
    estimates: [
      ...data.estimates,
      ...PHASES.map((phase) => ({ projectId: id, phase, originalMinutes: 0, revisedMinutes: null })),
    ],
  };
}

export function updateProjectDetails(
  data: AppData,
  projectId: string,
  input: { name: string; description: string },
  nowIso: string,
): AppData {
  findProject(data, projectId);
  return {
    ...data,
    projects: touchProject(data, projectId, nowIso, {
      name: cleanName(input.name),
      description: input.description.trim(),
    }),
  };
}

export function setProjectStatus(data: AppData, projectId: string, status: ProjectStatus, nowIso: string): AppData {
  findProject(data, projectId);
  if (status !== 'active' && data.activeTimer?.projectId === projectId) {
    throw new DomainError('Stop the running timer on this project first.');
  }
  return { ...data, projects: touchProject(data, projectId, nowIso, { status }) };
}

// ---------------------------------------------------------------------------
// Estimates
// ---------------------------------------------------------------------------

function assertMinutes(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) throw new DomainError('Estimates must be whole minutes, 0 or more.');
}

export function setOriginalEstimate(
  data: AppData,
  projectId: string,
  phase: Phase,
  minutes: number,
  nowIso: string,
): AppData {
  const project = findProject(data, projectId);
  if (project.baselineLockedAt !== null) {
    throw new DomainError('Original estimates are locked once tracking has started.');
  }
  if (project.status !== 'active') throw new DomainError('Only active projects can be planned.');
  assertMinutes(minutes);
  return {
    ...data,
    projects: touchProject(data, projectId, nowIso),
    estimates: data.estimates.map((e) =>
      e.projectId === projectId && e.phase === phase ? { ...e, originalMinutes: minutes } : e,
    ),
  };
}

/** `null` clears the revision. Never touches `originalMinutes`. */
export function setRevisedEstimate(
  data: AppData,
  projectId: string,
  phase: Phase,
  minutes: number | null,
  nowIso: string,
): AppData {
  const project = findProject(data, projectId);
  if (project.baselineLockedAt === null) {
    throw new DomainError('Revise estimates after tracking starts; until then, edit the original plan.');
  }
  if (project.status !== 'active') throw new DomainError('Only active projects can be re-forecast.');
  if (minutes !== null) assertMinutes(minutes);
  return {
    ...data,
    projects: touchProject(data, projectId, nowIso),
    estimates: data.estimates.map((e) =>
      e.projectId === projectId && e.phase === phase ? { ...e, revisedMinutes: minutes } : e,
    ),
  };
}

// ---------------------------------------------------------------------------
// Timer
// ---------------------------------------------------------------------------

export function startTimer(
  data: AppData,
  input: { projectId: string; phase: Phase; workMode: WorkMode; description: string },
  nowIso: string,
  sessionId: string = createId(),
): AppData {
  if (data.activeTimer) throw new DomainError('A timer is already running. Stop it before starting another.');
  const project = findProject(data, input.projectId);
  if (project.status !== 'active') throw new DomainError('Only active projects can be timed.');
  return {
    ...data,
    activeTimer: {
      sessionId,
      projectId: input.projectId,
      phase: input.phase,
      workMode: input.workMode,
      description: input.description.trim(),
      startedAt: nowIso,
    },
  };
}

/**
 * Converts the active timer into exactly one time entry and clears the timer.
 * Idempotent: if an entry for this session already exists, nothing is duplicated.
 */
export function saveTimerEntry(
  data: AppData,
  input: { sessionId: string; endedAt: string; interruption: string; description: string },
  nowIso: string,
  entryId: string = createId(),
): AppData {
  const existing = data.entries.find((e) => e.sessionId === input.sessionId);
  if (existing) {
    return data.activeTimer?.sessionId === input.sessionId ? { ...data, activeTimer: null } : data;
  }
  const timer = data.activeTimer;
  if (!timer || timer.sessionId !== input.sessionId) {
    throw new DomainError('This timer is no longer running.');
  }
  const validation = validateEntry({
    projectId: timer.projectId,
    phase: timer.phase,
    workMode: timer.workMode,
    startedAt: timer.startedAt,
    endedAt: input.endedAt,
    interruption: input.interruption,
  });
  if (!isValid(validation) || validation.net === null || validation.interruptionMinutes === null) {
    throw new DomainError(Object.values(validation.errors)[0] ?? INTERRUPTION_TOO_LARGE);
  }
  findProject(data, timer.projectId);

  const entry: TimeEntry = {
    id: entryId,
    sessionId: timer.sessionId,
    projectId: timer.projectId,
    phase: timer.phase,
    workMode: timer.workMode,
    startedAt: timer.startedAt,
    endedAt: input.endedAt,
    interruptionMinutes: validation.interruptionMinutes,
    netMinutes: validation.net,
    description: input.description.trim(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return {
    ...data,
    projects: lockBaseline(touchProject(data, timer.projectId, nowIso), timer.projectId, nowIso),
    entries: [...data.entries, entry],
    activeTimer: null,
  };
}

export function discardTimer(data: AppData, sessionId: string): AppData {
  if (data.activeTimer?.sessionId !== sessionId) return data;
  return { ...data, activeTimer: null };
}

// ---------------------------------------------------------------------------
// Time entries
// ---------------------------------------------------------------------------

function entryFromDraft(draft: EntryDraft): Pick<
  TimeEntry,
  'projectId' | 'phase' | 'workMode' | 'startedAt' | 'endedAt' | 'interruptionMinutes' | 'netMinutes'
> {
  const validation = validateEntry(draft);
  if (!isValid(validation) || validation.net === null || validation.interruptionMinutes === null) {
    throw new DomainError(Object.values(validation.errors)[0] ?? 'Check the entry details.');
  }
  return {
    projectId: draft.projectId,
    phase: draft.phase as Phase,
    workMode: draft.workMode as WorkMode,
    startedAt: new Date(draft.startedAt).toISOString(),
    endedAt: new Date(draft.endedAt).toISOString(),
    interruptionMinutes: validation.interruptionMinutes,
    netMinutes: validation.net,
  };
}

export function addManualEntry(
  data: AppData,
  draft: EntryDraft & { description: string },
  nowIso: string,
  entryId: string = createId(),
): AppData {
  const project = findProject(data, draft.projectId);
  if (project.status === 'archived') throw new DomainError('Archived projects are read-only.');
  const fields = entryFromDraft(draft);
  const entry: TimeEntry = {
    id: entryId,
    sessionId: null,
    ...fields,
    description: draft.description.trim(),
    createdAt: nowIso,
    updatedAt: nowIso,
  };
  return {
    ...data,
    projects: lockBaseline(touchProject(data, project.id, nowIso), project.id, nowIso),
    entries: [...data.entries, entry],
  };
}

export function updateEntry(
  data: AppData,
  entryId: string,
  draft: EntryDraft & { description: string },
  nowIso: string,
): AppData {
  const current = data.entries.find((e) => e.id === entryId);
  if (!current) throw new DomainError('That entry no longer exists.');
  const project = findProject(data, draft.projectId);
  if (project.status === 'archived' && project.id !== current.projectId) {
    throw new DomainError('Archived projects are read-only.');
  }
  const fields = entryFromDraft(draft);
  let projects = touchProject(data, current.projectId, nowIso);
  if (project.id !== current.projectId) projects = touchProject({ ...data, projects }, project.id, nowIso);
  return {
    ...data,
    projects: lockBaseline(projects, project.id, nowIso),
    entries: data.entries.map((e) =>
      e.id === entryId ? { ...e, ...fields, description: draft.description.trim(), updatedAt: nowIso } : e,
    ),
  };
}

export function deleteEntry(data: AppData, entryId: string, nowIso: string): AppData {
  const current = data.entries.find((e) => e.id === entryId);
  if (!current) return data;
  return {
    ...data,
    projects: touchProject(data, current.projectId, nowIso),
    entries: data.entries.filter((e) => e.id !== entryId),
  };
}

/** Recomputes net minutes from timestamps; used when loading stored data. */
export function recomputeNet(entry: TimeEntry): number {
  return grossMinutesBetween(entry.startedAt, entry.endedAt) - entry.interruptionMinutes;
}
