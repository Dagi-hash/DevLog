import { beforeEach, describe, expect, it } from "vitest";
import type { AppData } from "../domain/types";
import { createProject } from "../state/actions";
import { createDemoData } from "./demoData";
import { LEGACY_STORAGE_KEYS, SCHEMA_VERSION, STORAGE_KEY, loadAppData, saveAppData } from "./persistence";

const NOW = new Date("2026-10-14T15:00:00.000Z");

describe("persistence", () => {
  beforeEach(() => window.localStorage.clear());

  it("seeds demo data on first launch and saves it", () => {
    const result = loadAppData(window.localStorage, NOW);
    expect(result.issue).toBeNull();
    expect(result.data.projects.length).toBeGreaterThanOrEqual(2);
    expect(result.data.entries.length).toBeGreaterThan(0);
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.version).toBe(SCHEMA_VERSION);
    expect(stored.data.projects).toHaveLength(result.data.projects.length);
  });

  it("never overwrites existing user data with demo data", () => {
    const mine: AppData = createProject(
      { projects: [], estimates: [], entries: [], activeTimer: null },
      { name: "Mine", description: "" },
      NOW.toISOString(),
      "mine",
    );
    saveAppData(window.localStorage, mine);
    const result = loadAppData(window.localStorage, NOW);
    expect(result.data.projects.map((p) => p.name)).toEqual(["Mine"]);
  });

  it("keeps an empty dataset empty (no re-seeding after the user clears everything)", () => {
    saveAppData(window.localStorage, { projects: [], estimates: [], entries: [], activeTimer: null });
    expect(loadAppData(window.localStorage, NOW).data.projects).toHaveLength(0);
  });

  it("round-trips data including an active timer", () => {
    const demo = createDemoData(NOW);
    const withTimer: AppData = {
      ...demo,
      activeTimer: {
        sessionId: "s1",
        projectId: demo.projects[0]!.id,
        phase: "Code",
        workMode: "ai_assisted",
        description: "x",
        targetMinutes: 45,
        startedAt: "2026-10-14T14:00:00.000Z",
        pausedAt: "2026-10-14T14:20:00.000Z",
        pausedSeconds: 90,
      },
    };
    saveAppData(window.localStorage, withTimer);
    expect(loadAppData(window.localStorage, NOW).data).toEqual(withTimer);
  });

  it("recovers from unreadable JSON without crashing and keeps a backup", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    const result = loadAppData(window.localStorage, NOW);
    expect(result.issue).toMatch(/could not be read/);
    expect(result.data.projects.length).toBeGreaterThan(0);
    const backupKey = Object.keys(window.localStorage).find((k) => k.startsWith(`${STORAGE_KEY}:unreadable:`));
    expect(backupKey).toBeDefined();
    expect(window.localStorage.getItem(backupKey!)).toBe("{not json");
  });

  it("treats an unknown schema version as unreadable", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, data: {} }));
    expect(loadAppData(window.localStorage, NOW).issue).toMatch(/could not be read/);
  });

  it("drops invalid records and recomputes stored durations", () => {
    const demo = createDemoData(NOW);
    const good = demo.entries[0]!;
    const tampered = {
      ...demo,
      entries: [
        { ...good, netMinutes: 9999 }, // wrong stored total: recomputed
        { ...good, id: "bad-phase", phase: "Lunch" },
        { ...good, id: "bad-time", endedAt: "2000-01-01T00:00:00.000Z" },
        { ...good, id: "bad-int", interruptionMinutes: 100000 },
        { ...good, id: "orphan", projectId: "missing" },
      ],
      estimates: demo.estimates.filter((e) => e.phase !== "Test"), // gaps are filled
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, savedAt: "", data: tampered }));
    const result = loadAppData(window.localStorage, NOW);
    expect(result.data.entries).toHaveLength(1);
    expect(result.data.entries[0]?.netMinutes).toBe(good.netMinutes);
    expect(result.issue).toMatch(/4 invalid records/);
    expect(result.data.estimates).toHaveLength(demo.projects.length * 8);
  });

  it("migrates data saved under the previous app name", () => {
    const mine: AppData = createProject(
      { projects: [], estimates: [], entries: [], activeTimer: null },
      { name: "Old data", description: "" },
      NOW.toISOString(),
      "old",
    );
    const legacyKey = LEGACY_STORAGE_KEYS[0]!;
    window.localStorage.setItem(legacyKey, JSON.stringify({ version: SCHEMA_VERSION, savedAt: "", data: mine }));
    const result = loadAppData(window.localStorage, NOW);
    expect(result.data.projects.map((p) => p.name)).toEqual(["Old data"]);
    expect(window.localStorage.getItem(legacyKey)).toBeNull();
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).data.projects[0].name).toBe("Old data");
  });

  it("works in memory when storage is unavailable", () => {
    const result = loadAppData(null, NOW);
    expect(result.persistent).toBe(false);
    expect(result.data.projects.length).toBeGreaterThan(0);
  });
});

describe("demo data", () => {
  it("is internally consistent and has entries for today", () => {
    const demo = createDemoData(NOW);
    expect(demo.projects.filter((p) => p.status === "active").length).toBeGreaterThanOrEqual(2);
    for (const e of demo.entries) {
      expect(Date.parse(e.endedAt)).toBeLessThanOrEqual(NOW.getTime());
      expect(e.netMinutes).toBeGreaterThanOrEqual(0);
    }
    const sorted = [...demo.entries].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.startedAt >= sorted[i - 1]!.endedAt).toBe(true);
    }
  });
});
