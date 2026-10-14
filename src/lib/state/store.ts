"use client";

/**
 * The app's single source of state: AppData loaded from localStorage, exposed to
 * React through useSyncExternalStore. All changes go through `run`, which applies
 * a pure action, persists the result, and only then publishes it.
 */
import { useSyncExternalStore } from "react";
import type { AppData } from "../domain/types";
import { createDemoData } from "../storage/demoData";
import { STORAGE_KEY, getStorage, loadAppData, saveAppData } from "../storage/persistence";
import { DomainError } from "./actions";

export interface StoreState {
  data: AppData;
  /** False when localStorage is unavailable; data then lives in memory only. */
  persistent: boolean;
  /** One-off notice from loading (unreadable data, skipped records, no storage). */
  issue: string | null;
}

export type RunResult = { ok: true } | { ok: false; error: string };

let state: StoreState | null = null;
let storage: Storage | null = null;
const listeners = new Set<() => void>();

function ensureLoaded(): StoreState {
  if (state === null) {
    storage = getStorage();
    const loaded = loadAppData(storage);
    state = { data: loaded.data, persistent: loaded.persistent, issue: loaded.issue };
  }
  return state;
}

function emit() {
  for (const listener of listeners) listener();
}

/** Another tab saved: adopt its data so two tabs never run separate timers. */
function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  const loaded = loadAppData(storage);
  state = { data: loaded.data, persistent: loaded.persistent, issue: state?.issue ?? loaded.issue };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

const getServerSnapshot = () => null;

/** `null` during server rendering and hydration; the loaded state afterwards. */
export function useStoreState(): StoreState | null {
  return useSyncExternalStore(subscribe, ensureLoaded, getServerSnapshot);
}

export function useAppData(): AppData {
  const s = useStoreState();
  if (!s) throw new Error("useAppData must be used inside the loaded app shell.");
  return s.data;
}

/**
 * Applies a pure action. The new state is published only after it has been
 * written to localStorage, so a failed save never shows as saved.
 */
export function run(action: (data: AppData) => AppData): RunResult {
  const current = ensureLoaded();
  let next: AppData;
  try {
    next = action(current.data);
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
  }
  if (next === current.data) return { ok: true };
  try {
    saveAppData(storage, next);
  } catch {
    return {
      ok: false,
      error: "Couldn't save to this browser's storage. It may be full or blocked; nothing was changed.",
    };
  }
  state = { ...current, data: next };
  emit();
  return { ok: true };
}

export function dismissIssue() {
  const current = ensureLoaded();
  state = { ...current, issue: null };
  emit();
}

/** Explicit, confirmed reset to the original demo dataset. */
export function resetToDemoData(): RunResult {
  return run(() => createDemoData(new Date()));
}

/** Test helper: forget the in-memory state so the next read reloads from storage. */
export function __resetStoreForTests() {
  state = null;
  storage = null;
}
