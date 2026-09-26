"use client";

import { useSyncExternalStore } from "react";

import {
  getServerSnapshot,
  getSnapshot,
  setTheme,
  subscribe,
  type ThemeSnapshot,
} from "@/lib/theme/theme-store";

/** State only, for components that react to the theme without changing it. */
export function useThemeSnapshot(): ThemeSnapshot {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useTheme() {
  const { theme, resolvedTheme } = useThemeSnapshot();
  return { theme, resolvedTheme, setTheme };
}
