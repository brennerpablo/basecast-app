/**
 * The app destination under a right-click, or `null` and the menu stays with
 * the browser.
 *
 * It is `GlobalLinkMenu`'s predicate: any `<a href>` in the app shell (Next's
 * `Link`, the breadcrumb, a DataTable `link` cell) gets the link menu without
 * the screen knowing it exists. So the rule is what does NOT get it, and each
 * exclusion is a case where "open in an app tab" makes no sense:
 *
 * - **another origin**: an external site, `mailto:`, `tel:`; an app tab only
 *   opens app paths;
 * - **a `target` other than `_self`, or `download`**: whoever wrote the link
 *   meant to leave the window;
 * - **`/api/*`**: a file or JSON, not a screen;
 * - **only `#…`**: an anchor on the same screen;
 * - **inside `[role="menu"]`**: an item of an open dropdown (row actions),
 *   a menu on top of a menu;
 * - **`[data-native-menu]`** on the link or an ancestor: the explicit way out
 *   for what none of the rules above catches.
 *
 * Pure on purpose (the origin comes in as an argument): the test runs on a
 * JSDOM document, without a global `window`.
 */
export function linkTarget(target: Element | null, origin: string): string | null {
  const link = target?.closest("a[href]");
  if (!link) return null;

  const href = link.getAttribute("href") ?? "";
  if (href === "" || href.startsWith("#")) return null;

  const linkTargetAttr = link.getAttribute("target");
  if (linkTargetAttr && linkTargetAttr !== "_self") return null;
  if (link.hasAttribute("download")) return null;
  if (link.closest('[role="menu"], [data-native-menu]')) return null;

  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.origin !== new URL(origin).origin) return null;
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return null;

  return url.pathname + url.search + url.hash;
}
