import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/storage/persistence";
import { __resetStoreForTests } from "@/lib/state/store";
import type { AppData } from "@/lib/domain/types";
import { AppShell } from "./AppShell";
import { TimeLogPage } from "./pages/TimeLogPage";
import { TodayPage } from "./pages/TodayPage";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  useParams: () => ({}),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const START = new Date("2026-10-14T13:00:00.000Z");

function stored(): AppData {
  return JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).data;
}

function renderApp() {
  return render(
    <AppShell>
      <TodayPage />
    </AppShell>,
  );
}

describe("timer flow", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    __resetStoreForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts, survives a refresh, validates interruptions, cancels and saves exactly one entry", async () => {
    const user = userEvent.setup();
    const first = renderApp();

    // First launch shows the demo projects.
    const projectSelect = await screen.findByLabelText("Project");
    expect(within(projectSelect).getByRole("option", { name: "DevLog prototype" })).toBeInTheDocument();
    await user.selectOptions(projectSelect, "DevLog prototype");
    await user.click(screen.getByRole("radio", { name: /^Code(?! Review)/ }));
    await user.click(screen.getByRole("radio", { name: "AI-Agent" }));
    const entriesBefore = stored().entries.length;

    await user.click(screen.getByRole("button", { name: /Start timer/ }));

    // Persisted with a UTC start timestamp and a session id.
    const timer = stored().activeTimer!;
    expect(timer).toMatchObject({ projectId: "demo-workbench", phase: "Code", workMode: "ai_agent", startedAt: START.toISOString() });
    expect(timer.sessionId).toBeTruthy();
    expect(screen.getByTestId("elapsed")).toHaveTextContent("00:00:00");

    // "Refresh": unmount, drop in-memory state, move the clock, mount again.
    first.unmount();
    __resetStoreForTests();
    vi.setSystemTime(new Date(START.getTime() + (10 * 60 + 29) * 1000));
    renderApp();
    expect(await screen.findByTestId("elapsed")).toHaveTextContent("00:10:29");

    // Stop opens the completion dialog with rounded gross minutes.
    await user.click(screen.getByRole("button", { name: "Stop" }));
    const dialog = await screen.findByRole("dialog", { name: "Save time entry" });
    expect(within(dialog).getByTestId("gross-minutes")).toHaveTextContent("10m");

    const interruption = within(dialog).getByLabelText("Interruptions (minutes)");
    await user.clear(interruption);
    await user.type(interruption, "11");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Interruption time cannot exceed total elapsed time.");
    expect(within(dialog).getByRole("button", { name: "Save entry" })).toBeDisabled();

    // Cancel keeps the timer running.
    await user.click(within(dialog).getByRole("button", { name: "Keep running" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(stored().activeTimer?.sessionId).toBe(timer.sessionId);
    expect(screen.getByTestId("elapsed")).toBeInTheDocument();

    // Stop again and save.
    await user.click(screen.getByRole("button", { name: "Stop" }));
    const dialog2 = await screen.findByRole("dialog", { name: "Save time entry" });
    const interruption2 = within(dialog2).getByLabelText("Interruptions (minutes)");
    await user.clear(interruption2);
    await user.type(interruption2, "3");
    expect(within(dialog2).getByTestId("net-minutes")).toHaveTextContent("7m");
    const save = within(dialog2).getByRole("button", { name: "Save entry" });
    await act(async () => {
      save.click();
      save.click();
    });

    const after = stored();
    expect(after.activeTimer).toBeNull();
    expect(after.entries).toHaveLength(entriesBefore + 1);
    const saved = after.entries.filter((e) => e.sessionId === timer.sessionId);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ phase: "Code", workMode: "ai_agent", interruptionMinutes: 3, netMinutes: 7 });
    expect(await screen.findByRole("button", { name: /Start timer/ })).toBeInTheDocument();
  });

  it("starts with an expected length and, when it ran far over, ends the entry at the planned time", async () => {
    const user = userEvent.setup();
    const first = renderApp();

    await user.selectOptions(await screen.findByLabelText("Project"), "DevLog prototype");
    await user.click(screen.getByRole("radio", { name: /^25m/ }));
    await user.click(screen.getByRole("button", { name: /Start timer/ }));

    expect(stored().activeTimer).toMatchObject({ targetMinutes: 25, startedAt: START.toISOString() });
    expect(screen.getByTestId("target-status")).toHaveTextContent("25m left");

    // Forgotten: come back 70 minutes later.
    first.unmount();
    __resetStoreForTests();
    vi.setSystemTime(new Date(START.getTime() + 70 * 60_000));
    renderApp();
    expect(await screen.findByTestId("target-status")).toHaveTextContent("45m over");

    await user.click(screen.getByRole("button", { name: "Stop" }));
    const dialog = await screen.findByRole("dialog", { name: "Save time entry" });
    // Far past the plan, the planned end is suggested.
    expect(within(dialog).getByRole("radio", { name: /as planned/ })).toBeChecked();
    expect(within(dialog).getByTestId("gross-minutes")).toHaveTextContent("25m");
    await user.click(within(dialog).getByRole("radio", { name: /when I pressed Stop/ }));
    expect(within(dialog).getByTestId("gross-minutes")).toHaveTextContent("1h 10m");
    await user.click(within(dialog).getByRole("radio", { name: /as planned/ }));
    await user.click(within(dialog).getByRole("button", { name: "Save entry" }));

    const saved = stored().entries.find((e) => e.startedAt === START.toISOString() && e.sessionId !== null)!;
    expect(saved).toMatchObject({ targetMinutes: 25, netMinutes: 25, endedAt: new Date(START.getTime() + 25 * 60_000).toISOString() });
  });
});

describe("pausing and switching phase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    __resetStoreForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Moves the clock and lets the app catch up, as it does when the window regains focus. */
  function advance(minutes: number) {
    vi.setSystemTime(new Date(Date.now() + minutes * 60_000));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
  }

  it("excludes paused time from the clock and prefills it as interruptions", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.selectOptions(await screen.findByLabelText("Project"), "DevLog prototype");
    await user.click(screen.getByRole("radio", { name: /^Code(?! Review)/ }));
    await user.click(screen.getByRole("button", { name: /Start timer/ }));

    advance(10);
    await user.click(screen.getByRole("button", { name: "Pause" }));
    expect(stored().activeTimer?.pausedAt).toBeTruthy();
    advance(4);
    expect(screen.getByTestId("elapsed")).toHaveTextContent("00:10:00");
    expect(screen.getByTestId("session-since")).toHaveTextContent("Paused for 04:00");

    await user.click(screen.getByRole("button", { name: "Resume" }));
    advance(6);
    expect(screen.getByTestId("elapsed")).toHaveTextContent("00:16:00");

    await user.click(screen.getByRole("button", { name: "Stop" }));
    const dialog = await screen.findByRole("dialog", { name: "Save time entry" });
    expect(within(dialog).getByLabelText("Interruptions (minutes)")).toHaveValue("4");
    expect(within(dialog).getByText(/from the 4m you were paused/)).toBeInTheDocument();
    expect(within(dialog).getByTestId("net-minutes")).toHaveTextContent("16m");
    await user.click(within(dialog).getByRole("button", { name: "Save entry" }));
    expect(stored().entries.find((e) => e.startedAt === START.toISOString())).toMatchObject({
      interruptionMinutes: 4,
      netMinutes: 16,
    });
  });

  it("switches to the next phase in one tap, and can undo it", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.selectOptions(await screen.findByLabelText("Project"), "DevLog prototype");
    await user.click(screen.getByRole("radio", { name: /^Code(?! Review)/ }));
    await user.click(screen.getByRole("button", { name: /Start timer/ }));
    const entriesBefore = stored().entries.length;
    const first = stored().activeTimer!;

    advance(20);
    await user.click(screen.getByRole("button", { name: /Next: Code Review/ }));
    let after = stored();
    expect(after.entries).toHaveLength(entriesBefore + 1);
    expect(after.entries.find((e) => e.sessionId === first.sessionId)).toMatchObject({ phase: "Code", netMinutes: 20 });
    expect(after.activeTimer).toMatchObject({ phase: "Code Review", projectId: first.projectId });
    expect(screen.getByRole("status")).toHaveTextContent("Saved 20m of Code. Now timing Code Review.");
    expect(screen.getByTestId("elapsed")).toHaveTextContent("00:00:00");

    await user.click(screen.getByRole("button", { name: "Undo" }));
    after = stored();
    expect(after.entries).toHaveLength(entriesBefore);
    expect(after.activeTimer).toEqual(first);
    expect(screen.getByTestId("elapsed")).toHaveTextContent("00:20:00");
  });
});

describe("adding a past entry", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    __resetStoreForTests();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("asks how long it took and derives the start from a finish of just now", async () => {
    const user = userEvent.setup();
    render(
      <AppShell>
        <TimeLogPage />
      </AppShell>,
    );
    const before = (await screen.findAllByRole("button", { name: /^Edit / })).length;
    await user.click(screen.getAllByRole("button", { name: "Add entry" })[0]!);
    const dialog = await screen.findByRole("dialog", { name: "Add time entry" });

    const duration = within(dialog).getByLabelText("How long?");
    await user.clear(duration);
    await user.type(duration, "1h 15");
    expect(within(dialog).getByTestId("entry-net")).toHaveTextContent("1h 15m");
    await user.click(within(dialog).getByRole("button", { name: "Add entry" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const entries = stored().entries;
    expect(entries).toHaveLength(before + 1);
    const added = entries.find((e) => e.endedAt === START.toISOString() && e.sessionId === null)!;
    expect(added).toMatchObject({ startedAt: new Date(START.getTime() - 75 * 60_000).toISOString(), netMinutes: 75 });
  });
});
