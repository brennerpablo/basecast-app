import { divertFromPinned, recordTraversal } from "@/lib/tabs/tabs-store";

/**
 * Client instrumentation entry point (Next 16 convention: runs after HTML load
 * and before hydration). Tells the app's tab strip (`src/lib/tabs/tabs-store.ts`)
 * what is about to happen: it is the only signal that arrives BEFORE the new
 * URL reaches React.
 *
 * - `traverse`: a Back/Forward is on its way. A `popstate` listener is not a
 *   substitute: Next registers its own first, and the new URL is already
 *   applied when ours runs.
 * - `push`: a pinned tab never leaves its screen, so a push to another path
 *   from one opens in a new app tab. `replace` is left alone: it is what a
 *   `redirect()` does, and a pinned tab whose page redirects must not spawn a
 *   tab on every click.
 */
export function onRouterTransitionStart(
  url: string,
  navigationType: "push" | "replace" | "traverse",
): void {
  try {
    if (navigationType === "traverse") recordTraversal(url);
    if (navigationType === "push") {
      // `url` is the href as given to the router; it may be relative.
      const target = new URL(url, window.location.href);
      if (target.origin === window.location.origin) {
        divertFromPinned(target.pathname + target.search);
      }
    }
  } catch {
    // Instrumentation must never break navigation.
  }
}
