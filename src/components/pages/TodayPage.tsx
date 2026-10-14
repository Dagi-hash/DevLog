"use client";

import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sumNetMinutes } from "@/lib/domain/calculations";
import { formatLongDate, formatMinutes, formatTime, isSameLocalDay } from "@/lib/domain/format";
import type { AppData, Project } from "@/lib/domain/types";
import { useNow } from "@/lib/hooks/useNow";
import { loadPrefs } from "@/lib/state/prefs";
import { useAppData } from "@/lib/state/store";
import { EmptyState } from "../EmptyState";
import { ProjectForm } from "../ProjectForm";
import { TimerPanel } from "../TimerPanel";
import { Button, ModeGlyph } from "../ui";
import { useEntryDialogs } from "../useEntryDialogs";

export function TodayPage() {
  const data = useAppData();
  const now = new Date(useNow());
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => loadPrefs().projectId);
  const { openEdit, dialogs } = useEntryDialogs(data);

  const activeProjects = data.projects.filter((p) => p.status === "active");
  const selected = activeProjects.find((p) => p.id === selectedId) ?? mostRecentlyUsed(data, activeProjects) ?? null;

  if (data.projects.length === 0) {
    return (
      <>
        <DateHeading now={now} />
        <div className="mt-12 max-w-md">
          <EmptyState
            title="Start with a project"
            action={
              <Button variant="primary" size="lg" className="rounded-full" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Create a project
              </Button>
            }
          >
            A project holds your phase estimates and every minute you record against them.
          </EmptyState>
        </div>
        <ProjectForm open={creating} onClose={() => setCreating(false)} onCreated={(id) => router.push(`/projects/${id}`)} />
      </>
    );
  }

  const todays = data.entries
    .filter((e) => isSameLocalDay(e.startedAt, now))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  return (
    <>
      <DateHeading now={now} />

      <div className="mt-10 grid gap-x-20 gap-y-16 lg:mt-14 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 max-w-xl">
          <TimerPanel data={data} projectId={selected?.id ?? null} onProjectChange={setSelectedId} />
        </div>

        <section aria-labelledby="today-heading" className="min-w-0">
          <div className="flex items-baseline justify-between pb-3">
            <h2 id="today-heading" className="text-meta text-fg-3">
              Today
            </h2>
            <span className="num font-mono text-meta text-fg-2">{formatMinutes(sumNetMinutes(todays))}</span>
          </div>
          {todays.length === 0 ? (
            <p className="border-t border-hairline py-5 text-body text-fg-3">Nothing recorded yet.</p>
          ) : (
            <ul className="border-t border-hairline">
              {todays.map((entry) => (
                <li key={entry.id} className="border-b border-hairline">
                  <button
                    type="button"
                    onClick={() => openEdit(entry)}
                    className="flex min-h-14 w-full items-center gap-3 py-3 text-left transition-colors hover:bg-hover"
                    aria-label={`Edit ${entry.phase} entry, ${formatMinutes(entry.netMinutes)}`}
                  >
                    <ModeGlyph mode={entry.workMode} className="text-fg-3" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-fg">{entry.phase}</span>
                      <span className="num block font-mono text-tiny text-fg-3">{formatTime(entry.startedAt)}</span>
                    </span>
                    <span className="num font-mono text-body text-fg-2">{formatMinutes(entry.netMinutes)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Link href="/log" className="mt-2 inline-flex h-11 items-center gap-1.5 text-meta text-fg-3 transition-colors hover:text-fg">
            Time log <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </section>
      </div>
      {dialogs}
    </>
  );
}

function DateHeading({ now }: { now: Date }) {
  return (
    <h1 className="text-title font-semibold tracking-[-0.025em] text-fg" suppressHydrationWarning>
      {formatLongDate(now)}
    </h1>
  );
}

function mostRecentlyUsed(data: AppData, candidates: Project[]): Project | undefined {
  const ids = new Set(candidates.map((p) => p.id));
  const latest = [...data.entries]
    .filter((e) => ids.has(e.projectId))
    .sort((a, b) => b.endedAt.localeCompare(a.endedAt))[0];
  return candidates.find((p) => p.id === latest?.projectId) ?? candidates[0];
}
