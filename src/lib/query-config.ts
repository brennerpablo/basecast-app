/**
 * Single source of truth for the client-side TanStack Query cache window.
 *
 * Set as the global `staleTime` default on the app QueryClient
 * (`src/components/providers.tsx`), so individual hooks should NOT restate it —
 * omit `staleTime` to inherit this value. Only override per-query when a hook
 * genuinely needs a different window (e.g. `staleTime: 0` to always refetch).
 */
export const DEFAULT_QUERY_STALE_MS = 60 * 1000;
