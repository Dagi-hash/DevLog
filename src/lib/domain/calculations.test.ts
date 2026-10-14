import { describe, expect, it } from "vitest";
import {
  buildProjectSummary,
  elapsedSeconds,
  grossMinutes,
  grossMinutesBetween,
  varianceMinutes,
  variancePercent,
} from "./calculations";
import { formatClock, formatMinutes, formatPercentVariance, formatSignedMinutes } from "./format";
import type { PhaseEstimate, TimeEntry } from "./types";

const T0 = "2026-10-14T09:00:00.000Z";
const at = (seconds: number) => new Date(Date.parse(T0) + seconds * 1000).toISOString();

function entry(partial: Partial<TimeEntry> & Pick<TimeEntry, "phase" | "workMode" | "netMinutes">): TimeEntry {
  return {
    id: Math.random().toString(36),
    sessionId: null,
    projectId: "p1",
    startedAt: T0,
    endedAt: at(partial.netMinutes * 60),
    interruptionMinutes: 0,
    description: "",
    targetMinutes: null,
    createdAt: T0,
    updatedAt: T0,
    ...partial,
  };
}

describe("durations", () => {
  it("computes whole elapsed seconds from timestamps, truncating sub-seconds", () => {
    expect(elapsedSeconds(T0, at(90))).toBe(90);
    expect(elapsedSeconds(T0, new Date(Date.parse(T0) + 29_999).toISOString())).toBe(29);
    expect(elapsedSeconds(at(10), T0)).toBe(0);
    expect(elapsedSeconds("not a date", T0)).toBe(0);
  });

  it.each([
    [0, 0],
    [29, 0],
    [30, 1],
    [89, 1],
    [90, 2],
    [149, 2],
    [150, 3],
    [3599, 60],
  ])("rounds %i s half-up to %i min", (seconds, minutes) => {
    expect(grossMinutes(seconds)).toBe(minutes);
  });

  it("rounds between timestamps", () => {
    expect(grossMinutesBetween(T0, at(10 * 60 + 29))).toBe(10);
    expect(grossMinutesBetween(T0, at(10 * 60 + 30))).toBe(11);
  });
});

describe("variance", () => {
  it("is actual − estimate (positive means over)", () => {
    expect(varianceMinutes(30, 45)).toBe(-15);
    expect(varianceMinutes(80, 60)).toBe(20);
  });

  it("computes percentages to one decimal place", () => {
    expect(variancePercent(30, 45)).toEqual({ kind: "value", value: -33.3 });
    expect(variancePercent(30, 60)).toEqual({ kind: "value", value: -50 });
    expect(variancePercent(80, 90)).toEqual({ kind: "value", value: -11.1 });
    expect(variancePercent(2, 3)).toEqual({ kind: "value", value: -33.3 });
    expect(variancePercent(120, 120)).toEqual({ kind: "value", value: 0 });
  });

  it("handles zero estimates without Infinity or NaN", () => {
    expect(variancePercent(0, 0)).toEqual({ kind: "zero" });
    expect(variancePercent(20, 0)).toEqual({ kind: "unestimated" });
    expect(formatPercentVariance(variancePercent(0, 0))).toBe("0.0%");
    expect(formatPercentVariance(variancePercent(20, 0))).toBe("Unestimated");
  });

  it("formats signed values", () => {
    expect(formatPercentVariance(variancePercent(80, 60))).toBe("+33.3%");
    expect(formatPercentVariance(variancePercent(30, 45))).toBe("−33.3%");
    expect(formatSignedMinutes(20)).toBe("+20");
    expect(formatSignedMinutes(-15)).toBe("−15");
    expect(formatSignedMinutes(0)).toBe("0");
  });
});

describe("formatting", () => {
  it("formats minutes and clocks", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
    expect(formatMinutes(135)).toBe("2h 15m");
    expect(formatClock(3725)).toBe("01:02:05");
  });
});

describe("buildProjectSummary", () => {
  const estimates: PhaseEstimate[] = [
    { projectId: "p1", phase: "Code", originalMinutes: 60, revisedMinutes: 90 },
    { projectId: "p1", phase: "Test", originalMinutes: 30, revisedMinutes: null },
    { projectId: "p2", phase: "Code", originalMinutes: 999, revisedMinutes: null },
  ];
  const entries = [
    entry({ phase: "Code", workMode: "manual", netMinutes: 50 }),
    entry({ phase: "Code", workMode: "ai_agent", netMinutes: 30 }),
    entry({ phase: "Test", workMode: "manual", netMinutes: 30 }),
    entry({ phase: "Test", workMode: "ai_agent", netMinutes: 20 }),
    entry({ phase: "Test", workMode: "manual", netMinutes: 500, projectId: "p2" }),
  ];
  const summary = buildProjectSummary("p1", estimates, entries);

  it("has a row for every phase, defaulting to zero", () => {
    expect(summary.rows).toHaveLength(8);
    expect(summary.rows.find((r) => r.phase === "Plan")).toMatchObject({ original: 0, revised: null, actual: 0 });
  });

  it("sums actuals per phase from this project only", () => {
    expect(summary.rows.find((r) => r.phase === "Code")?.actual).toBe(80);
    // 30 manual + 20 agent supervision = 50 Test minutes, counted once.
    expect(summary.rows.find((r) => r.phase === "Test")?.actual).toBe(50);
  });

  it("splits by work mode without changing the actual", () => {
    for (const row of summary.rows) {
      expect(row.byMode.manual + row.byMode.ai_assisted + row.byMode.ai_agent).toBe(row.actual);
    }
    expect(summary.rows.find((r) => r.phase === "Test")?.byMode).toEqual({ manual: 30, ai_assisted: 0, ai_agent: 20 });
  });

  it("totals equal the sum of the phase rows", () => {
    expect(summary.totals.actual).toBe(summary.rows.reduce((s, r) => s + r.actual, 0));
    expect(summary.totals.actual).toBe(130);
    expect(summary.totals.original).toBe(90);
    expect(summary.totals.byMode).toEqual({ manual: 80, ai_assisted: 0, ai_agent: 50 });
  });

  it("total revised uses revised where set and original elsewhere", () => {
    expect(summary.totals.revised).toBe(90 + 30);
    const unrevised = buildProjectSummary("p2", estimates, entries);
    expect(unrevised.totals.revised).toBeNull();
  });
});
