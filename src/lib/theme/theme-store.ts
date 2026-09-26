"use client";

import {
  DEFAULT_THEME,
  isDarkTheme,
  readThemeCookie,
  type ResolvedTheme,
  resolvedThemeOf,
  serializeCookie,
  type Theme,
  THEME_COOKIE,
} from "./theme-cookie";

export type ThemeSnapshot = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
};

/**
 * The server snapshot is a CONSTANT, and has to be: `useSyncExternalStore`
 * needs a stable value here. There is no hydration mismatch to fear: React
 * compares it with the client snapshot and re-renders synchronously when they
 * differ.
 */
const SERVER_SNAPSHOT: ThemeSnapshot = {
  theme: DEFAULT_THEME,
  resolvedTheme: "light",
};

const listeners = new Set<() => void>();
let snapshot: ThemeSnapshot | null = null;

/**
 * The source of truth is the COOKIE, never the class in the DOM.
 *
 * The StrictMode remount in dev clears the attributes on `<html>`, and the
 * router has been seen wiping inline styles on the root. Reading the class
 * back would turn either of those into "the user picked light".
 */
function read(): ThemeSnapshot {
  const theme = readThemeCookie(document.cookie);
  return { theme, resolvedTheme: resolvedThemeOf(theme) };
}

function current(): ThemeSnapshot {
  snapshot ??= read();
  return snapshot;
}

/** Writes the class and attribute on `<html>` from the current snapshot. */
export function applyTheme(): void {
  const { theme, resolvedTheme } = current();
  const root = document.documentElement;
  const dark = resolvedTheme === "dark";
  root.classList.toggle("dark", dark);
  // `zinc` IS the base `.dark`, so it needs no attribute.
  if (dark && isDarkTheme(theme) && theme !== "zinc") {
    root.setAttribute("data-dark-palette", theme);
  } else {
    root.removeAttribute("data-dark-palette");
  }
}

function commit(next: ThemeSnapshot): void {
  const prev = current();
  snapshot = next;
  applyTheme();
  if (next.theme === prev.theme && next.resolvedTheme === prev.resolvedTheme) return;
  for (const listener of listeners) listener();
}

export function setTheme(theme: Theme): void {
  document.cookie = serializeCookie(THEME_COOKIE, theme);
  commit({ theme, resolvedTheme: resolvedThemeOf(theme) });
}

export function getSnapshot(): ThemeSnapshot {
  return current();
}

export function getServerSnapshot(): ThemeSnapshot {
  return SERVER_SNAPSHOT;
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // A cookie fires no event the way `localStorage` does, so the cheapest
  // cross-tab sync is to re-read it when the tab becomes visible again.
  const onVisible = () => {
    if (document.visibilityState === "visible") commit(read());
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    listeners.delete(listener);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
