import { describe, expect, it } from "vitest";
import { INTERRUPTION_TOO_LARGE, isValid, parseDuration, parseWholeMinutes, validateEntry, type EntryDraft } from "./validation";

const base: EntryDraft = {
  projectId: "p1",
  phase: "Code",
  workMode: "manual",
  startedAt: "2026-10-14T09:00:00.000Z",
  endedAt: "2026-10-14T09:10:00.000Z",
  interruption: "0",
};

describe("parseWholeMinutes", () => {
  it("accepts non-negative integers and treats blank as 0", () => {
    expect(parseWholeMinutes("0")).toBe(0);
    expect(parseWholeMinutes(" 15 ")).toBe(15);
    expect(parseWholeMinutes("")).toBe(0);
  });
  it.each(["-1", "1.5", "abc", "1e3", "١٢"])("rejects %s", (raw) => {
    expect(parseWholeMinutes(raw)).toBeNull();
  });
});

describe("validateEntry", () => {
  it("computes gross and net", () => {
    const v = validateEntry({ ...base, interruption: "3" });
    expect(isValid(v)).toBe(true);
    expect(v.gross).toBe(10);
    expect(v.net).toBe(7);
  });

  it("allows interruption equal to gross", () => {
    const v = validateEntry({ ...base, interruption: "10" });
    expect(isValid(v)).toBe(true);
    expect(v.net).toBe(0);
  });

  it("blocks interruption greater than gross", () => {
    const v = validateEntry({ ...base, interruption: "15" });
    expect(isValid(v)).toBe(false);
    expect(v.errors.interruption).toBe(INTERRUPTION_TOO_LARGE);
    expect(v.net).toBeNull();
  });

  it("blocks non-integer and negative interruptions", () => {
    expect(validateEntry({ ...base, interruption: "2.5" }).errors.interruption).toBeDefined();
    expect(validateEntry({ ...base, interruption: "-2" }).errors.interruption).toBeDefined();
  });

  it("requires end at or after start", () => {
    expect(validateEntry({ ...base, endedAt: "2026-10-14T08:59:00.000Z" }).errors.endedAt).toBeDefined();
    const same = validateEntry({ ...base, endedAt: base.startedAt });
    expect(isValid(same)).toBe(true);
    expect(same.gross).toBe(0);
  });

  it("rejects invalid dates, phases, modes and missing project", () => {
    const v = validateEntry({ projectId: "", phase: "Lunch", workMode: "robot", startedAt: "x", endedAt: "", interruption: "0" });
    expect(Object.keys(v.errors).sort()).toEqual(["endedAt", "phase", "projectId", "startedAt", "workMode"]);
  });
});

describe("parseDuration", () => {
  it.each([
    ["45", 45],
    ["45m", 45],
    ["45 min", 45],
    ["1h", 60],
    ["1h30", 90],
    ["1h 30m", 90],
    ["1:30", 90],
    ["1.5h", 90],
    ["2 hours", 120],
    ["0", 0],
  ])("reads %s as %i minutes", (raw, minutes) => {
    expect(parseDuration(raw)).toBe(minutes);
  });
  it.each(["", "abc", "1.5", "-5", "1:75", "h"])("rejects %s", (raw) => {
    expect(parseDuration(raw)).toBeNull();
  });
});

describe("future end check", () => {
  const latestEndMs = Date.parse(base.endedAt);
  it("allows an end up to a minute ahead of now", () => {
    expect(isValid(validateEntry({ ...base, endedAt: "2026-10-14T09:10:59.000Z" }, { latestEndMs }))).toBe(true);
  });
  it("rejects an end in the future", () => {
    expect(validateEntry({ ...base, endedAt: "2026-10-14T09:30:00.000Z" }, { latestEndMs }).errors.endedAt).toMatch(/future/);
  });
});
