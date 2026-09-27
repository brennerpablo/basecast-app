"use client";

import { useEffect, useState } from "react";

/** How long a panel takes to leave; the exit classes below run for the same time. */
export const EXIT_MS = 200;

/**
 * A panel that opens on a value (a county, a node) and closes when it clears: `shown` is the value to render,
 * held for `exitMs` after the value clears so the panel can animate out; `closing` is true meanwhile. A new
 * value while closing reopens at once.
 */
export function usePresence<T>(value: T | null | undefined, exitMs = EXIT_MS): { shown: T | null; closing: boolean } {
  const [last, setLast] = useState<T | null>(value ?? null);
  // Adopt a new value during render (React's "state from props" pattern), so the panel opens in the same frame.
  if (value != null && value !== last) setLast(value);
  useEffect(() => {
    if (value != null || last == null) return;
    const timer = setTimeout(() => setLast(null), exitMs);
    return () => clearTimeout(timer);
  }, [value, last, exitMs]);
  return { shown: value ?? last, closing: value == null && last != null };
}

/**
 * The enter and exit of a side panel (tw-animate-css): a fade with a short slide from the right, gone for
 * people who ask for reduced motion. Exit keeps its last frame so the panel does not flash back before it unmounts.
 */
export const PANEL_ENTER = "animate-in fade-in-0 slide-in-from-right-6 duration-300 ease-out motion-reduce:animate-none";
export const PANEL_EXIT =
  "animate-out fade-out-0 slide-out-to-right-6 duration-200 ease-in fill-mode-forwards motion-reduce:animate-none";

/** A panel's content swapping in place (another county, another node): a quick fade. */
export const CONTENT_SWAP = "animate-in fade-in-0 duration-200 motion-reduce:animate-none";
