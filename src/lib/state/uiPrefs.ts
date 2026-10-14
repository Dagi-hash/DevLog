"use client";

import { useSyncExternalStore } from "react";

/** Interface preferences that only affect layout (safe to lose). */
const KEY = "devlog:sidebar-collapsed";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let collapsed: boolean | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  if (collapsed === null) collapsed = read();
  return collapsed;
}

export function useSidebarCollapsed(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

export function setSidebarCollapsed(value: boolean) {
  collapsed = value;
  try {
    window.localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Layout preference only.
  }
  for (const listener of listeners) listener();
}
