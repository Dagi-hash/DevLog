"use client";

import { useSyncExternalStore } from "react";

/**
 * Current time in ms, refreshed every second while anything is subscribed and
 * immediately when the page becomes visible again (iPhone unlock, Mac wake,
 * tab switch). Elapsed time is always computed as now − start, never counted.
 */
let now = 0;
const listeners = new Set<() => void>();
let interval: ReturnType<typeof setInterval> | null = null;

function tick() {
  now = Date.now();
  for (const listener of listeners) listener();
}

function onVisible() {
  if (document.visibilityState === "visible") tick();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    interval = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    window.addEventListener("pageshow", tick);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (interval) clearInterval(interval);
      interval = null;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
      window.removeEventListener("pageshow", tick);
    }
  };
}

function getSnapshot() {
  if (now === 0) now = Date.now();
  return now;
}

const getServerSnapshot = () => 0;

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
