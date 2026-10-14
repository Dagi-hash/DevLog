import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnchorHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEY } from "@/lib/storage/persistence";
import { __resetStoreForTests } from "@/lib/state/store";
import type { AppData } from "@/lib/domain/types";
import { AppShell } from "./AppShell";
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
});
