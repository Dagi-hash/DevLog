import { isPhase, isWorkMode, type Phase, type WorkMode } from "../domain/psp";

/** Last selections in the start form. A convenience only; safe to lose. */
export interface StartPrefs {
  projectId: string | null;
  phase: Phase;
  workMode: WorkMode;
}

const PREFS_KEY = "devlog:prefs";
const LEGACY_PREFS_KEY = "psp-workbench:prefs";

export function loadPrefs(): StartPrefs {
  const fallback: StartPrefs = { projectId: null, phase: "Plan", workMode: "manual" };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY) ?? window.localStorage.getItem(LEGACY_PREFS_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    const p = parsed as Record<string, unknown>;
    return {
      projectId: typeof p.projectId === "string" ? p.projectId : null,
      phase: isPhase(p.phase) ? p.phase : fallback.phase,
      workMode: isWorkMode(p.workMode) ? p.workMode : fallback.workMode,
    };
  } catch {
    return fallback;
  }
}

export function savePrefs(prefs: StartPrefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Not important enough to report.
  }
}
