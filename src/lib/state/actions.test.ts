import { describe, expect, it } from "vitest";
import { buildProjectSummary } from "../domain/calculations";
import { PHASES } from "../domain/psp";
import type { AppData } from "../domain/types";
import {
  DomainError,
  addManualEntry,
  createProject,
  deleteEntry,
  discardTimer,
  pauseTimer,
  pausedInterruption,
  resumeTimer,
  saveTimerEntry,
  setOriginalEstimate,
  setProjectStatus,
  setRevisedEstimate,
  setTimerTarget,
  startTimer,
  switchTimerPhase,
  updateEntry,
  updateProjectDetails,
} from "./actions";

const NOW = "2026-10-14T12:00:00.000Z";
const empty: AppData = { projects: [], estimates: [], entries: [], activeTimer: null };
const plus = (iso: string, seconds: number) => new Date(Date.parse(iso) + seconds * 1000).toISOString();

function withProject(): AppData {
  return createProject(empty, { name: "  Program   1A ", description: "" }, NOW, "p1");
}

function startAndSave(data: AppData, seconds: number, interruption = "0", sessionId = "s1") {
  const started = startTimer(data, { projectId: "p1", phase: "Code", workMode: "manual", description: "" }, NOW, sessionId);
  return saveTimerEntry(
    started,
    { sessionId, endedAt: plus(NOW, seconds), interruption, description: "done" },
    plus(NOW, seconds),
    `e-${sessionId}`,
  );
}

describe("projects", () => {
  it("creates a project with all eight phase estimates at zero", () => {
    const data = withProject();
    expect(data.projects[0]).toMatchObject({ id: "p1", name: "Program 1A", status: "active", baselineLockedAt: null });
    expect(data.estimates.map((e) => e.phase)).toEqual([...PHASES]);
    expect(data.estimates.every((e) => e.originalMinutes === 0 && e.revisedMinutes === null)).toBe(true);
  });

  it("rejects blank names", () => {
    expect(() => createProject(empty, { name: "   ", description: "" }, NOW)).toThrow(DomainError);
  });

  it("renames and archives", () => {
    let data = updateProjectDetails(withProject(), "p1", { name: "Renamed", description: "x" }, NOW);
    expect(data.projects[0]?.name).toBe("Renamed");
    data = setProjectStatus(data, "p1", "archived", NOW);
    expect(data.projects[0]?.status).toBe("archived");
  });

  it("does not allow timers on completed or archived projects", () => {
    for (const status of ["completed", "archived"] as const) {
      const data = setProjectStatus(withProject(), "p1", status, NOW);
      expect(() =>
        startTimer(data, { projectId: "p1", phase: "Plan", workMode: "manual", description: "" }, NOW),
      ).toThrow(/active projects/);
    }
  });

  it("cannot complete a project while its timer runs", () => {
    const data = startTimer(withProject(), { projectId: "p1", phase: "Plan", workMode: "manual", description: "" }, NOW);
    expect(() => setProjectStatus(data, "p1", "completed", NOW)).toThrow(/Stop the running timer/);
  });
});

describe("estimates", () => {
  it("edits originals until tracking starts, then locks them", () => {
    let data = setOriginalEstimate(withProject(), "p1", "Code", 45, NOW);
    expect(data.estimates.find((e) => e.phase === "Code")?.originalMinutes).toBe(45);
    expect(() => setRevisedEstimate(data, "p1", "Code", 60, NOW)).toThrow(/after tracking starts/);

    data = startAndSave(data, 30 * 60);
    expect(data.projects[0]?.baselineLockedAt).toBe(plus(NOW, 30 * 60));
    expect(() => setOriginalEstimate(data, "p1", "Code", 50, NOW)).toThrow(/locked/);
  });

  it("changing the revised estimate never touches the original", () => {
    let data = startAndSave(setOriginalEstimate(withProject(), "p1", "Code", 45, NOW), 60);
    data = setRevisedEstimate(data, "p1", "Code", 60, NOW);
    expect(data.estimates.find((e) => e.phase === "Code")).toMatchObject({ originalMinutes: 45, revisedMinutes: 60 });
    data = setRevisedEstimate(data, "p1", "Code", null, NOW);
    expect(data.estimates.find((e) => e.phase === "Code")).toMatchObject({ originalMinutes: 45, revisedMinutes: null });
  });

  it("rejects negative or fractional estimates", () => {
    expect(() => setOriginalEstimate(withProject(), "p1", "Code", -1, NOW)).toThrow(DomainError);
    expect(() => setOriginalEstimate(withProject(), "p1", "Code", 1.5, NOW)).toThrow(DomainError);
  });

  it("stays locked even if every entry is deleted", () => {
    let data = startAndSave(withProject(), 120);
    data = deleteEntry(data, "e-s1", NOW);
    expect(data.entries).toHaveLength(0);
    expect(() => setOriginalEstimate(data, "p1", "Code", 10, NOW)).toThrow(/locked/);
  });
});

describe("timer", () => {
  it("allows only one running timer", () => {
    const data = startTimer(withProject(), { projectId: "p1", phase: "Plan", workMode: "manual", description: "" }, NOW, "s1");
    expect(data.activeTimer).toMatchObject({ sessionId: "s1", startedAt: NOW, phase: "Plan" });
    expect(() =>
      startTimer(data, { projectId: "p1", phase: "Code", workMode: "manual", description: "" }, NOW, "s2"),
    ).toThrow(/already running/);
  });

  it("saves exactly one entry with rounded gross minus interruptions, then clears the timer", () => {
    const data = startAndSave(withProject(), 10 * 60 + 29, "3");
    expect(data.entries).toHaveLength(1);
    expect(data.entries[0]).toMatchObject({ sessionId: "s1", interruptionMinutes: 3, netMinutes: 7, description: "done" });
    expect(data.activeTimer).toBeNull();
  });

  it("records the expected length on the timer and carries it to the saved entry", () => {
    const started = startTimer(
      withProject(),
      { projectId: "p1", phase: "Code", workMode: "manual", description: "", targetMinutes: 45 },
      NOW,
      "s1",
    );
    expect(started.activeTimer).toMatchObject({ targetMinutes: 45, startedAt: NOW });
    const extended = setTimerTarget(started, "s1", 60);
    expect(extended.activeTimer?.targetMinutes).toBe(60);
    // Ending at the expected time (not when Stop was pressed) is just an earlier endedAt.
    const saved = saveTimerEntry(extended, { sessionId: "s1", endedAt: plus(NOW, 3600), interruption: "0", description: "" }, NOW, "e1");
    expect(saved.entries[0]).toMatchObject({ targetMinutes: 60, netMinutes: 60 });
  });

  it("defaults to an open-ended session and rejects a zero-minute target", () => {
    const started = startTimer(withProject(), { projectId: "p1", phase: "Code", workMode: "manual", description: "" }, NOW, "s1");
    expect(started.activeTimer?.targetMinutes).toBeNull();
    expect(() => setTimerTarget(started, "s1", 0)).toThrow(DomainError);
    expect(() => setTimerTarget(started, "other", 30)).toThrow(/no longer running/);
  });

  it("is idempotent: saving the same session twice does not duplicate", () => {
    const once = startAndSave(withProject(), 600);
    const twice = saveTimerEntry(once, { sessionId: "s1", endedAt: plus(NOW, 600), interruption: "0", description: "" }, NOW, "e-other");
    expect(twice.entries).toHaveLength(1);
  });

  it("blocks saving when interruption exceeds gross and keeps the timer", () => {
    const started = startTimer(withProject(), { projectId: "p1", phase: "Code", workMode: "manual", description: "" }, NOW, "s1");
    expect(() =>
      saveTimerEntry(started, { sessionId: "s1", endedAt: plus(NOW, 600), interruption: "11", description: "" }, NOW),
    ).toThrow(/cannot exceed/);
    expect(started.activeTimer?.sessionId).toBe("s1");
  });

  it("discards only the matching session", () => {
    const started = startTimer(withProject(), { projectId: "p1", phase: "Code", workMode: "manual", description: "" }, NOW, "s1");
    expect(discardTimer(started, "other").activeTimer).not.toBeNull();
    expect(discardTimer(started, "s1").activeTimer).toBeNull();
  });
});

describe("time entries", () => {
  const draft = {
    projectId: "p1",
    phase: "Test",
    workMode: "ai_agent",
    startedAt: "2026-10-13T09:00:00.000Z",
    endedAt: "2026-10-13T09:45:00.000Z",
    interruption: "5",
    description: "agent run review",
  };

  it("adds manual entries and locks the baseline", () => {
    const data = addManualEntry(withProject(), draft, NOW, "m1");
    expect(data.entries[0]).toMatchObject({ id: "m1", sessionId: null, netMinutes: 40, phase: "Test", workMode: "ai_agent" });
    expect(data.projects[0]?.baselineLockedAt).toBe(NOW);
  });

  it("editing recalculates the duration and project totals", () => {
    let data = addManualEntry(withProject(), draft, NOW, "m1");
    expect(buildProjectSummary("p1", data.estimates, data.entries).totals.actual).toBe(40);
    data = updateEntry(data, "m1", { ...draft, endedAt: "2026-10-13T10:30:00.000Z", interruption: "0" }, NOW);
    expect(data.entries[0]?.netMinutes).toBe(90);
    expect(buildProjectSummary("p1", data.estimates, data.entries).totals.actual).toBe(90);
  });

  it("deleting recalculates totals", () => {
    let data = addManualEntry(withProject(), draft, NOW, "m1");
    data = addManualEntry(data, { ...draft, startedAt: "2026-10-13T11:00:00.000Z", endedAt: "2026-10-13T11:20:00.000Z", interruption: "0" }, NOW, "m2");
    expect(buildProjectSummary("p1", data.estimates, data.entries).totals.actual).toBe(60);
    data = deleteEntry(data, "m1", NOW);
    expect(buildProjectSummary("p1", data.estimates, data.entries).totals.actual).toBe(20);
  });

  it("rejects invalid manual entries", () => {
    expect(() => addManualEntry(withProject(), { ...draft, interruption: "50" }, NOW)).toThrow(/cannot exceed/);
    expect(() => addManualEntry(withProject(), { ...draft, endedAt: "2026-10-13T08:00:00.000Z" }, NOW)).toThrow(/End must be/);
  });

  it("does not add entries to archived projects", () => {
    const data = setProjectStatus(withProject(), "p1", "archived", NOW);
    expect(() => addManualEntry(data, draft, NOW)).toThrow(/Archived/);
  });
});

describe("pausing", () => {
  const start = () =>
    startTimer(withProject(), { projectId: "p1", phase: "Code", workMode: "manual", description: "" }, NOW, "s1");

  it("accumulates paused time across pauses and turns it into interruptions", () => {
    let data = pauseTimer(start(), "s1", plus(NOW, 600));
    expect(data.activeTimer?.pausedAt).toBe(plus(NOW, 600));
    expect(pauseTimer(data, "s1", plus(NOW, 700))).toBe(data); // already paused
    data = resumeTimer(data, "s1", plus(NOW, 900)); // 5 min paused
    data = pauseTimer(data, "s1", plus(NOW, 1200));
    expect(data.activeTimer).toMatchObject({ pausedAt: plus(NOW, 1200), pausedSeconds: 300 });
    // Stopped while still paused: the open pause counts too (5 + 3 min).
    expect(pausedInterruption(data.activeTimer!, plus(NOW, 1380))).toBe(8);
  });

  it("never implies more interruption than the session's gross time", () => {
    const paused = pauseTimer(start(), "s1", NOW);
    expect(pausedInterruption(paused.activeTimer!, plus(NOW, 29))).toBe(0);
    expect(pausedInterruption(paused.activeTimer!, plus(NOW, 600))).toBe(10);
  });
});

describe("switching phase", () => {
  it("saves the current session and starts the next phase from the same instant", () => {
    let data = startTimer(
      withProject(),
      { projectId: "p1", phase: "Code", workMode: "ai_agent", description: "parser", targetMinutes: 45 },
      NOW,
      "s1",
    );
    data = resumeTimer(pauseTimer(data, "s1", plus(NOW, 600)), "s1", plus(NOW, 780)); // 3 min paused
    const at = plus(NOW, 40 * 60);
    const switched = switchTimerPhase(data, { sessionId: "s1", phase: "Compile", at }, at, "e1", "s2");

    expect(switched.entries).toHaveLength(1);
    expect(switched.entries[0]).toMatchObject({
      sessionId: "s1",
      phase: "Code",
      workMode: "ai_agent",
      endedAt: at,
      interruptionMinutes: 3,
      netMinutes: 37,
      description: "parser",
      targetMinutes: 45,
    });
    expect(switched.activeTimer).toMatchObject({
      sessionId: "s2",
      projectId: "p1",
      phase: "Compile",
      workMode: "ai_agent",
      startedAt: at,
      description: "",
      targetMinutes: null,
      pausedAt: null,
      pausedSeconds: 0,
    });
    expect(switched.projects[0]!.baselineLockedAt).toBe(at);
  });

  it("relabels a session too short to record instead of saving it", () => {
    const data = startTimer(withProject(), { projectId: "p1", phase: "Code", workMode: "manual", description: "" }, NOW, "s1");
    const switched = switchTimerPhase(data, { sessionId: "s1", phase: "Test", at: plus(NOW, 20) }, NOW);
    expect(switched.entries).toHaveLength(0);
    expect(switched.activeTimer).toMatchObject({ sessionId: "s1", phase: "Test", startedAt: NOW });
  });
});

