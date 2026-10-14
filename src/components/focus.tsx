"use client";

import { createContext, useContext } from "react";

export interface FocusControls {
  /** Whether the full-screen session view is showing. */
  isOpen: boolean;
  open: () => void;
  minimize: () => void;
}

const FocusContext = createContext<FocusControls>({ isOpen: false, open: () => {}, minimize: () => {} });

export const FocusProvider = FocusContext.Provider;

export function useFocus(): FocusControls {
  return useContext(FocusContext);
}
