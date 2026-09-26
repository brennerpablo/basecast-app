import type { SavedView } from "./types";

/**
 * localStorage-backed persistence for saved filter views. Isolated behind
 * load/save so the storage backend stays swappable. Views are per browser:
 * they never reach the server or another person.
 */

export function loadViews(storageKey: string): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw == null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SavedView[]) : [];
  } catch {
    return [];
  }
}

/** Persist views. Returns false when storage refuses (quota/privacy mode). */
export function saveViews(storageKey: string, views: SavedView[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(views));
    return true;
  } catch {
    return false;
  }
}
