import type { Phase, ProjectStatus, WorkMode } from './psp';

/** All timestamps are ISO-8601 strings in UTC, e.g. "2026-10-14T09:30:00.000Z". */
export type IsoTimestamp = string;

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  /**
   * Set when the first time entry is saved. From then on, original estimates
   * are the frozen baseline and cannot be edited in the normal interface.
   */
  baselineLockedAt: IsoTimestamp | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface PhaseEstimate {
  projectId: string;
  phase: Phase;
  /** The initial plan. Never changed by revisions. */
  originalMinutes: number;
  /** Optional re-forecast. `null` means "not revised". */
  revisedMinutes: number | null;
}

export interface TimeEntry {
  id: string;
  /** Timer session that produced this entry; `null` for manually added entries. */
  sessionId: string | null;
  projectId: string;
  phase: Phase;
  workMode: WorkMode;
  startedAt: IsoTimestamp;
  endedAt: IsoTimestamp;
  interruptionMinutes: number;
  /** Rounded gross minutes minus interruptions. Always recomputed from timestamps. */
  netMinutes: number;
  description: string;
  /** Minutes the session was expected to take when it started; `null` if none was set. */
  targetMinutes: number | null;
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
}

export interface ActiveTimer {
  sessionId: string;
  projectId: string;
  phase: Phase;
  workMode: WorkMode;
  description: string;
  /** Expected length ("done in 45m"), chosen at start and extendable; `null` = open-ended. */
  targetMinutes: number | null;
  startedAt: IsoTimestamp;
  /** Set while paused. Paused time becomes the entry's interruptions. */
  pausedAt: IsoTimestamp | null;
  /** Whole seconds spent in pauses that have already ended. */
  pausedSeconds: number;
}

export interface AppData {
  projects: Project[];
  estimates: PhaseEstimate[];
  entries: TimeEntry[];
  activeTimer: ActiveTimer | null;
}
