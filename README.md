# DevLog

`>Log` — a quiet instrument for tracking the **Personal Software Process (PSP)** across manual,
AI-assisted and agentic engineering. It answers four questions for one developer:

1. What did I plan to spend on this project?
2. How much time have I actually spent in each development phase?
3. How accurate were my original estimates?
4. How much of my time was manual work, AI assistance, or supervising AI agents?

> **Local prototype.** All data lives in this browser's `localStorage`. There is no backend,
> no account and no sync: your Mac and your iPhone each keep their own separate data.
> Clearing site data in the browser erases it.

## Features

- **Today**: pick a project, PSP phase, how long it should take and work mode, then start.
  The start time is taken from the moment you press Start; you never type it.
  - "How long will it take?" offers 15m–2h, "No limit", and the rest of the phase's plan.
- **Focus session**: starting a session opens a full-screen view.
  - The clock sits inside a dial of 60 second-ticks, with a fading trail behind the current second.
  - Controls are Pause / Resume, Stop and Minimize. A minimized session stays one tap away in
    the sidebar (desktop) or the capsule nav (mobile).
  - **Pause** (or Space) freezes the clock. Paused time is excluded from the clock and the
    expected end, and becomes the entry's interruptions, prefilled in the stop sheet.
  - **Switch phase**: "Next: Compile" (one tap) or "Switch phase…" (any phase) saves the
    session and immediately times the new phase on the same project and work mode. An Undo
    appears for a few seconds. A session under 30 seconds is just relabelled.
  - The timer survives refreshes, closed tabs, browser restarts, phone locking and Mac sleep,
    because elapsed time is always `now − saved start timestamp`, never a counter.
  - With an expected length, a thin outer ring fills up and the view shows time left (or over).
    Near or past the end, **+15 min** extends it.
  - Stop opens a sheet for interruptions and a description, then saves exactly one entry.
    If the session ran well past its expected length (a forgotten timer), the sheet offers to
    end the entry at the planned time instead. Discarding needs a second tap.
- **Projects**: create, rename, complete, archive and restore. Completed and archived projects
  can't be timed, but their records and summaries are kept.
- **Plan and actuals**: original and revised estimates per phase, actuals derived from saved
  entries, variance against both in minutes and percent, a totals row, and an optional
  Manual / AI-Assisted / AI-Agent breakdown. A table on desktop, compact cards on phones.
- **Time log**: chronological entries grouped by day, filterable by project and work mode,
  with manual add, edit and delete (with confirmation). Adding past work asks only
  **how long** ("45", "1h 30m", "1:30") and **when it finished** (now, by default); the start is
  derived. Exact start and end fields are one tap away and are what editing shows.
- **Settings** (sidebar on desktop, top-bar icon on mobile): data notes, reference definitions
  and a confirmed **Reset demo data**.

## Design

- **Identity:** the wordmark is simply `>Log` set in the serif; `>L` is the collapsed sidebar
  mark and the favicon (`src/components/Logo.tsx`). The favicon (`src/app/icon.png`),
  iOS icon (`src/app/apple-icon.png`) and PWA icons (`public/icons/`, including a padded
  maskable one for Android) are rendered from the same Newsreader glyphs.
- **Monochrome only.** Tokens live in `src/app/globals.css` (`@theme`): canvas `#0A0A0A`,
  surfaces `#171717` / `#262626`, border `#343434`, text `#FAFAFA` / `#A3A3A3` / `#737373`,
  plus an inverse pair for primary actions. Type sizes, radii and motion are tokens too.
- **Less on screen.** Today shows the composer and today's entries, nothing else. A project
  shows one figure, one bar and the phase table.
- **No colour coding.** Work modes use shape (Manual ○, AI-Assisted ◐, AI-Agent ●, drawn as
  SVG). Over-plan time is hatched. Variance relies on its sign.
- **Type:** Inter for the interface, with tabular figures wherever numbers line up; Newsreader
  (serif) for titles, dialog headings and the figures worth looking at, including the clock.
- **Navigation:**
  - Desktop has a quiet sidebar that collapses to an icon rail. The state is remembered.
  - Mobile has a floating capsule nav. The current tab expands to show its label, and a
    running session appears as a chip.
- **Motion:** short and purposeful.
  - Pages fade in on navigation.
  - The focus view fades and settles in, and fades out on minimize or stop.
  - The nav animates on selection.
  - All of it is disabled under `prefers-reduced-motion`.
- Icons come from `lucide-react` only.

## Rules the app enforces

| Rule | Where |
| --- | --- |
| Gross minutes = `floor((elapsedSeconds + 30) / 60)` (half-up) | `src/lib/domain/calculations.ts` |
| Net = gross − interruptions; interruptions are whole minutes, `0 ≤ I ≤ gross` | `src/lib/domain/validation.ts` |
| Variance = actual − estimate (positive = over); % = variance ÷ estimate × 100, one decimal | `calculations.ts` |
| Estimate 0 and actual 0 → `0.0%`; estimate 0 and actual > 0 → `Unestimated` | `calculations.ts`, `format.ts` |
| Original estimates are editable until the project's first saved entry, then locked for good | `src/lib/state/actions.ts` |
| Revised estimates are separate, optional and editable after the lock; they never overwrite originals | `actions.ts` |
| One running timer per browser; saving is idempotent per timer session | `actions.ts`, `store.ts` |
| Each entry has exactly one work mode, so mode breakdowns always add up to the phase actual | `calculations.ts` |
| Summaries are always derived from saved entries; stored totals are recomputed on load | `persistence.ts` |

The PSP phase list (Plan, Design, Design Review, Code, Code Review, Compile, Test, Postmortem)
is **provisional** and lives in one constant, `PHASES` in `src/lib/domain/psp.ts`.

## Project structure

```
src/
  app/                    Next.js routes (/, /projects, /projects/[id], /log, /settings)
  components/
    AppShell.tsx          Collapsible sidebar (desktop), capsule nav (mobile), focus state
    FocusSession.tsx      Full-screen session view with the second-tick dial
    TimerPanel.tsx        Session composer; minimized-session card
    Logo.tsx              >Log wordmark and >L monogram
    StopTimerDialog.tsx   Interruptions, net duration, save / keep running / discard
    ProjectSummary.tsx    Planned-vs-actual table (desktop) and cards (mobile)
    EstimateEditor.tsx    Inline minutes input
    TimeEntryForm.tsx     Add / edit entry dialog
    TimeEntryList.tsx     Day-grouped entry list
    ProjectForm.tsx, Dialog.tsx, ConfirmDialog.tsx, EmptyState.tsx, ui.tsx
    pages/                Today, Projects, Project detail, Time log, Settings
  lib/
    domain/               Types, PSP constants, calculations, validation, formatting
    state/actions.ts      Pure state transitions (all business rules; unit-tested)
    state/store.ts        localStorage-backed store via useSyncExternalStore
    storage/              Versioned persistence, validation of stored data, demo data
    hooks/useNow.ts       1-second clock that refreshes immediately on wake/visibility
```

Every change goes through `run(action)` in `store.ts`. It applies a pure action from
`actions.ts`, writes the result to `localStorage`, and only then updates the UI. If the
write fails (storage full or blocked), nothing changes and the user sees an error.

Stored data is one versioned JSON document under the key `devlog`. On load:

- Data saved by earlier builds under `psp-workbench` is moved to the new key.

- Missing data seeds the demo dataset.
- Unreadable data is copied to a backup key and replaced with the demo dataset, with a notice.
- Invalid individual records are skipped, with a notice.

Demo data is written only on first launch or by the explicit reset.

## Requirements

- Node.js 20.19+ (22 LTS recommended)
- pnpm 12 (`packageManager` is pinned in `package.json`; `corepack enable` picks it up)

## Run locally

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. To try it on an iPhone on the same Wi-Fi, run
`pnpm dev -H 0.0.0.0` and open `http://<your-mac-ip>:3000` in Safari.

## Test, check and build

```bash
pnpm test        # Vitest: calculations, validation, actions, persistence, timer flow
pnpm typecheck   # next typegen + tsc --noEmit (strict)
pnpm lint        # ESLint (next/core-web-vitals + TypeScript)
pnpm build       # production build
pnpm start       # serve the production build locally
```

## Deploy to Vercel

No environment variables, secrets or backend are needed.

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, import the repository, and keep the detected
   **Next.js** framework preset.
3. Deploy. `vercel.json` pins the install to pnpm 12.6.0, which matches the lockfile format.
4. Open the HTTPS URL on your iPhone. In Safari, choose **Share → Add to Home Screen** to
   run it full-screen.

If the project was previously linked to Vercel with environment variables from an earlier
version of this repo, you can delete them; this app doesn't read any.

## Known limitations

- Data stays in one browser on one device. There is no sync and no export yet.
- iOS may clear a home-screen web app's storage if it goes unused for a long time.
- The timer can't notify you while the phone is locked. It simply shows the correct time
  when you come back.
- Defect tracking, "To Date" PSP metrics and backend storage are out of scope for this prototype.
