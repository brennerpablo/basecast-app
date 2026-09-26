/**
 * The app's tabs: several screens open in the same window, each remembering
 * where it was. Ported from fundsys-app (which ported it from upstate-ops-app);
 * the rules live in the "Same-window tabs" section of `CLAUDE.md`.
 *
 * **A tab is a URL, and the URL belongs to the active tab.** Switching tabs is
 * navigating to the tab's URL, and every URL change (a link, a `nuqs` filter,
 * a screen's `router.push`) is written to the active tab. That is the rule
 * that spares the screens from cooperating: none of them needs to know the
 * strip exists.
 *
 * **Back/Forward return the screen to the tab that showed it.** Every browser
 * history entry has an owner, remembered by the entry's KEY in the Navigation
 * API (`navigation.currentEntry.key`), in a map stored with the tabs. Nothing
 * is written to the history on purpose: `nuqs` intercepts every
 * `history.replaceState` and, when the call is not its own, aborts its queue
 * of URL updates not yet written; stamping the tab into `history.state` would
 * swallow typing in a URL-bound field. The key survives `replaceState` (a
 * changed filter is the same entry) and F5.
 *
 * Without the Navigation API, what is left is knowing the navigation is a
 * traversal (Next reports it in `onRouterTransitionStart(url, "traverse")`,
 * which `src/instrumentation-client.ts` forwards to `recordTraversal`) and
 * reactivating the tab that already shows that URL. A `popstate` listener does
 * not work: Next registers its own first, and the new URL reaches the strip
 * before ours runs.
 *
 * Module state with a subscription (`useSyncExternalStore`): the strip
 * subscribes to the list, screens only call the operations. Stored in
 * `sessionStorage` (per browser tab, survives F5) under a key per OWNER, the
 * signed-in user's id.
 *
 * **A pinned tab never leaves the screen it was pinned on.** Its path is
 * fixed; only the query changes (a filter, a sub-tab). Navigating to another
 * path from it (a menu item, a link, `router.push`) opens in a new tab right
 * after the pinned ones, and the pinned tab stays where it was. The divert
 * happens BEFORE the navigation (`divertFromPinned`, called by
 * `onRouterTransitionStart` in `src/instrumentation-client.ts`), so the new
 * screen is born in the new tab; `receiveUrl` and `initTabs` repeat the rule
 * for what arrives without passing there. A `redirect()` is a `replace`, not a
 * `push`: a pinned tab whose page redirects stays that URL's pinned tab
 * instead of spawning a tab on every click.
 *
 * **Pinned tabs also go to `localStorage`**, to come back in every new window.
 * Each window writes only what changed in ITS pinned tabs, merged by id over
 * what is stored (see `persistPinned`): two open windows do not undo each
 * other's pins.
 *
 * **A pinned tab carries its screen state** (`useTabState`: `DataTable`
 * filters, sorting and columns) for the path it is on. The URL alone is not
 * enough: those filters do not live in the query, and a pinned tab reopened in
 * a new window or after F5 would come back unfiltered.
 */

export type ScreenTitle = {
  text: string;
  /** The path where the screen gave that name: off it, the title comes from
   *  the URL again, so a tab that left an account page does not keep the
   *  account's name. */
  path: string;
};

export type Tab = {
  id: string;
  /** `pathname` + `?query`, normalized by `normalizeUrl`. */
  url: string;
  title?: ScreenTitle;
  /** Breaks the tie between two tabs on the same URL in a traversal without
   *  the Navigation API. */
  activatedAt: number;
  /** Sits on the left, without an X, and comes back in every new window
   *  (`localStorage`). */
  pinned?: boolean;
  /** Name given by the user, pinned tabs only (`renameTab`). Holds on any
   *  path, unlike `title`: whoever renamed it named the tab, not the screen. */
  name?: string;
};

export type TabsState = {
  tabs: readonly Tab[];
  active: string;
};

type Stored = {
  v: 1;
  tabs: Tab[];
  active: string;
  /** History entry key → id of the tab that owns it. */
  entries: Record<string, string>;
};

const VERSION = 1;
const PREFIX = "basecast";

let state: TabsState | null = null;
let owner: string | null = null;
let sessionKey: string | null = null;
let pinnedKey: string | null = null;
/** The pinned tabs as this window last read or wrote them; see `persistPinned`. */
let lastPinnedSerial: string | null = null;
/** The last JSON this window wrote to `sessionStorage`; see `persist`. */
let lastSessionSerial: string | null = null;
let entries: Record<string, string> = {};
/** Title a screen asked for before the strip created the state. */
let pendingTitle: ScreenTitle | null = null;
/** Target URL of the last Back/Forward; see `recordTraversal`. */
let traversal: string | null = null;
/** The navigation the strip started to show a tab; see `screenOwner`. */
let tabNavigation: { tab: string; url: string } | null = null;
/** The tab that owns the visible screen, confirmed after commit. */
let mountedScreenTab: string | null = null;
/** The tab the page loaded in; its screen keeps the "initial" key. */
let initialTab: string | null = null;
/** Screen state kept per tab and per path (`useTabState`). */
const screenMemory = new Map<string, unknown>();
const listeners = new Set<() => void>();

// ---------------------------------------------------------------------------
// Subscription

export function subscribeTabs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTabs(): TabsState | null {
  return state;
}

/** On the server there are no tabs: the strip draws the request URL. */
export function getServerTabs(): TabsState | null {
  return null;
}

function publish(next: TabsState) {
  state = { ...next, tabs: pinnedFirst(next.tabs) };
  persist();
  for (const listener of listeners) listener();
}

/** Pinned tabs always on the left, in their order. */
function pinnedFirst(tabs: readonly Tab[]): Tab[] {
  return [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)];
}

/** Unpinning drops the given name too: renaming is for pinned tabs. */
function unpinned(tab: Tab): Tab {
  const copy = { ...tab };
  delete copy.pinned;
  delete copy.name;
  return copy;
}

function pinnedCount(tabs: readonly Tab[]): number {
  return tabs.filter((t) => t.pinned).length;
}

/** The URL would take the tab off its screen, which a pinned tab never does. */
function leavesPinned(tab: Tab | undefined, url: string): boolean {
  return !!tab?.pinned && pathOf(tab.url) !== pathOf(url);
}

/** The new tab that takes what the pinned one does not show: right after the
 *  pinned tabs, where "Open in new tab" would put it from one of them. */
function withTabAfterPinned(
  tabs: readonly Tab[],
  url: string,
): { tabs: Tab[]; tab: Tab } {
  const tab = newTab(url);
  const list = [...tabs];
  list.splice(pinnedCount(list), 0, tab);
  return { tabs: list, tab };
}

// ---------------------------------------------------------------------------
// URL

/**
 * The canonical form of an app URL: path + re-serialized query, no origin or
 * hash. Re-serializing is what makes `?q=a b` (from `useSearchParams`) and
 * `?q=a+b` (from `location.search`) the same tab.
 */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url, "http://basecast.local");
    const search = u.searchParams.toString();
    return u.pathname + (search ? `?${search}` : "");
  } catch {
    return "/";
  }
}

export function pathOf(url: string): string {
  const i = url.indexOf("?");
  return i < 0 ? url : url.slice(0, i);
}

/** The URL the document shows now, in canonical form. */
export function documentUrl(): string {
  return normalizeUrl(window.location.pathname + window.location.search);
}

// ---------------------------------------------------------------------------
// Navigation API: only the part in use, because TypeScript's `lib.dom` does
// not have `window.navigation` yet.

type HistoryEntry = { key: string };
type BrowserNavigation = {
  currentEntry: HistoryEntry | null;
  entries(): HistoryEntry[];
};

function navigationApi(): BrowserNavigation | null {
  if (typeof window === "undefined") return null;
  const n = (window as Window & { navigation?: BrowserNavigation }).navigation;
  return n && typeof n.entries === "function" ? n : null;
}

function currentEntryKey(): string | null {
  return navigationApi()?.currentEntry?.key ?? null;
}

/** Drops the entries the browser already discarded and those of closed tabs:
 *  the map never grows past the browser tab's own history. */
function pruneEntries() {
  const alive = new Set(
    navigationApi()
      ?.entries()
      .map((e) => e.key) ?? [],
  );
  const tabs = new Set(state?.tabs.map((t) => t.id) ?? []);
  for (const [key, tab] of Object.entries(entries)) {
    if ((alive.size > 0 && !alive.has(key)) || !tabs.has(tab)) {
      delete entries[key];
    }
  }
}

// ---------------------------------------------------------------------------
// Persistence

function persist() {
  if (!state || !sessionKey) return;
  pruneEntries();
  const stored: Stored = {
    v: VERSION,
    tabs: [...state.tabs],
    active: state.active,
    entries,
  };
  // The same value is not written again: `receiveUrl` comes through here on
  // every URL change, including when only the history entry got an owner and
  // nothing stored changed. The `sessionStorage` belongs to this browser tab,
  // and only this store writes this key.
  const serial = JSON.stringify(stored);
  if (serial !== lastSessionSerial) {
    try {
      sessionStorage.setItem(sessionKey, serial);
      lastSessionSerial = serial;
    } catch {
      // Private mode or full quota: the tabs last until F5, and that's all.
    }
  }
  persistPinned();
}

/** A pinned tab in `localStorage`. The id is the tab's: the same pinned tab
 *  has the same id in every window, and that is what two windows' writes merge
 *  on. `screens` is the screen state of the URL's path, by `useTabState` key. */
type StoredPinned = {
  id: string;
  url: string;
  title?: ScreenTitle;
  name?: string;
  screens?: Record<string, unknown>;
};

function pinnedOf(tabs: readonly Tab[]): StoredPinned[] {
  return tabs
    .filter((t) => t.pinned)
    .map((t) => {
      const screens = screensOfPinned(t);
      return {
        id: t.id,
        url: t.url,
        title: t.title,
        ...(t.name ? { name: t.name } : {}),
        ...(screens ? { screens } : {}),
      };
    });
}

/** The tab's screen state on the path it is on: what it shows when reopened.
 *  Other paths it went through stay in this window's memory only. */
function screensOfPinned(tab: Tab): Record<string, unknown> | undefined {
  const prefix = `${tab.id}${SEP}${pathOf(tab.url)}${SEP}`;
  let screens: Record<string, unknown> | undefined;
  for (const [k, v] of screenMemory) {
    if (k.startsWith(prefix)) (screens ??= {})[k.slice(prefix.length)] = v;
  }
  return screens;
}

/** A date filter keeps a `Date`, which JSON would bring back as text and break
 *  the filter on reopen. It goes out marked and comes back a `Date`. */
const DATE_MARK = "$date";

function serializePinned(p: StoredPinned): string {
  return JSON.stringify(p, function (this: unknown, k: string, v: unknown) {
    const raw = (this as Record<string, unknown>)[k];
    if (!(raw instanceof Date)) return v;
    return Number.isNaN(raw.getTime()) ? null : { [DATE_MARK]: raw.toISOString() };
  });
}

function reviveDate(_k: string, v: unknown): unknown {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const iso = o[DATE_MARK];
    if (typeof iso === "string" && Object.keys(o).length === 1) {
      return new Date(iso);
    }
  }
  return v;
}

function serializePinnedList(list: readonly StoredPinned[]): string {
  return `[${list.map(serializePinned).join(",")}]`;
}

/**
 * Writes to `localStorage` what changed in THIS window's pinned tabs since the
 * last read or write, and only that, PER PINNED TAB. Writing the whole list
 * would make the window opened first undo the filter another window just
 * applied to a pinned tab both have, on its first gesture on any other pinned
 * tab. The merge: this window's pinned tabs in its order (this window's
 * version where it changed, the stored one where it did not), then those only
 * the other windows have, minus those this window unpinned or closed.
 */
function persistPinned() {
  if (!state || !pinnedKey) return;
  const mine = pinnedOf(state.tabs);
  const serial = serializePinnedList(mine);
  if (serial === lastPinnedSerial) return;
  const before = new Map(
    lastPinnedSerial
      ? // `lastPinnedSerial` never comes from storage: it only holds this
        // window's `serializePinnedList` output (or null).
        (JSON.parse(lastPinnedSerial) as StoredPinned[]).map((p) => [
          p.id,
          JSON.stringify(p),
        ])
      : [],
  );
  lastPinnedSerial = serial;
  const stored = loadPinned(pinnedKey);
  const ids = new Set(mine.map((p) => p.id));
  const left = (id: string) => before.has(id) && !ids.has(id);
  const list = mine.map((p) => {
    const changed = before.get(p.id) !== serializePinned(p);
    return (!changed && stored.find((s) => s.id === p.id)) || p;
  });
  const others = stored.filter((p) => !ids.has(p.id) && !left(p.id));
  try {
    localStorage.setItem(pinnedKey, serializePinnedList([...list, ...others]));
  } catch {
    // No localStorage (or full quota): pinned tabs last in this window only.
  }
}

function loadPinned(key: string): StoredPinned[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const list = JSON.parse(raw, reviveDate) as unknown;
    if (!Array.isArray(list)) return [];
    return list.filter(isTab).map((p: StoredPinned) => ({
      id: p.id,
      url: normalizeUrl(p.url),
      title: p.title,
      ...(p.name ? { name: p.name } : {}),
      ...(p.screens && typeof p.screens === "object" && !Array.isArray(p.screens)
        ? { screens: p.screens }
        : {}),
    }));
  } catch {
    return [];
  }
}

/** Puts back in memory the screen state stored with the pinned tabs. */
function restoreScreens(pinned: readonly StoredPinned[], tabs: readonly Tab[]) {
  for (const p of pinned) {
    const tab = tabs.find((t) => t.id === p.id && t.pinned);
    if (!tab || !p.screens) continue;
    const path = pathOf(p.url);
    for (const [key, value] of Object.entries(p.screens)) {
      screenMemory.set(memoryKey(p.id, path, key), value);
    }
  }
}

function isTab(v: unknown): v is Tab {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  if (typeof t.id !== "string" || typeof t.url !== "string") return false;
  if (!t.url.startsWith("/")) return false;
  if (t.name !== undefined && typeof t.name !== "string") return false;
  if (t.title !== undefined) {
    const title = t.title as Record<string, unknown> | null;
    if (!title || typeof title.text !== "string" || typeof title.path !== "string") {
      return false;
    }
  }
  return true;
}

function load(key: string): Stored | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stored>;
    if (s.v !== VERSION || !Array.isArray(s.tabs) || s.tabs.length === 0) {
      return null;
    }
    const tabs = s.tabs.filter(isTab).map((t) => ({
      id: t.id,
      url: normalizeUrl(t.url),
      title: t.title,
      activatedAt: typeof t.activatedAt === "number" ? t.activatedAt : 0,
      ...(t.pinned === true ? { pinned: true } : {}),
      ...(t.pinned === true && t.name ? { name: t.name } : {}),
    }));
    if (tabs.length === 0) return null;
    const active =
      typeof s.active === "string" && tabs.some((t) => t.id === s.active)
        ? s.active
        : tabs[0].id;
    const storedEntries: Record<string, string> = {};
    if (s.entries && typeof s.entries === "object") {
      for (const [k, v] of Object.entries(s.entries)) {
        if (typeof v === "string") storedEntries[k] = v;
      }
    }
    return { v: VERSION, tabs: pinnedFirst(tabs), active, entries: storedEntries };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Start and URL sync

function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function newTab(url: string): Tab {
  return { id: newId(), url: normalizeUrl(url), activatedAt: Date.now() };
}

/**
 * Builds the state the first time the strip shows up for this owner. Returns
 * `false` when it was already built; the caller then goes on with `receiveUrl`.
 *
 * What was stored is only restored when this is the SAME browser tab: F5 and
 * Back land on an entry the map knows, and whoever typed an address has
 * history behind them. A new browser tab has a single entry, and some browsers
 * copy the source tab's `sessionStorage` into it, which would make Cmd+click
 * open a window with the other one's whole list.
 *
 * A new window starts with the pinned tabs from `localStorage` plus the tab of
 * the arrival URL, unless a pinned tab is already on it; then that one is
 * activated.
 */
export function initTabs(tabsOwner: string, url: string): boolean {
  if (state && owner === tabsOwner) return false;

  owner = tabsOwner;
  sessionKey = `${PREFIX}.tabs.${tabsOwner}`;
  pinnedKey = `${PREFIX}.pinned-tabs.${tabsOwner}`;
  lastSessionSerial = null;
  entries = {};
  screenMemory.clear();
  const currentUrl = normalizeUrl(url);
  const stored = load(sessionKey);
  const storedPinned = loadPinned(pinnedKey);
  const key = currentEntryKey();
  const knownEntry = key !== null && !!stored?.entries[key];
  const sameBrowserTab = knownEntry || window.history.length > 1;

  let next: TabsState;
  if (stored && sameBrowserTab) {
    entries = { ...stored.entries };
    const entryOwner = key ? stored.tabs.find((t) => t.id === stored.entries[key]) : undefined;
    const target =
      entryOwner ?? stored.tabs.find((t) => t.id === stored.active) ?? stored.tabs[0];
    if (!leavesPinned(target, currentUrl)) {
      next = {
        tabs: stored.tabs.map((t) => (t.id === target.id ? { ...t, url: currentUrl } : t)),
        active: target.id,
      };
    } else if (entryOwner) {
      // F5 on an entry of the pinned tab that a `redirect()` took to another
      // path: the pinned tab stays active, with its own URL.
      next = { tabs: stored.tabs, active: target.id };
    } else {
      // A full load (typed address, `<a>` without the router) on top of a
      // pinned tab: it is a navigation away from it.
      const { tabs, tab } = withTabAfterPinned(stored.tabs, currentUrl);
      next = { tabs, active: tab.id };
    }
  } else {
    const pinned: Tab[] = storedPinned.map((p) => ({
      id: p.id,
      url: p.url,
      title: p.title,
      ...(p.name ? { name: p.name } : {}),
      activatedAt: 0,
      pinned: true,
    }));
    const alreadyOpen = pinned.find((t) => t.url === currentUrl);
    if (alreadyOpen) {
      alreadyOpen.activatedAt = Date.now();
      next = { tabs: pinned, active: alreadyOpen.id };
    } else {
      const tab = newTab(currentUrl);
      next = { tabs: [...pinned, tab], active: tab.id };
    }
  }
  // The pinned tabs' screen state comes back before the first screen reads it
  // (on F5 too, which clears the memory): a pinned tab must not come back
  // unfiltered.
  restoreScreens(storedPinned, next.tabs);
  // The starting point is what this window knows of the pinned tabs: only a
  // change made HERE writes over what another window wrote.
  lastPinnedSerial = serializePinnedList(pinnedOf(next.tabs));

  if (key) entries[key] = next.active;
  state = next;
  initialTab = next.active;
  mountedScreenTab = next.active;
  if (pendingTitle) {
    const pending = pendingTitle;
    pendingTitle = null;
    applyTitle(pending);
  }
  publish(state);
  return true;
}

/**
 * Keeps the target of a Back/Forward; see `receiveUrl`. Called by
 * `instrumentation-client.ts`, which Next calls BEFORE applying the traversal,
 * so the strip already knows what that URL is when it arrives.
 */
export function recordTraversal(url: string) {
  traversal = normalizeUrl(url);
}

/**
 * A `push` is about to start (a link, `router.push`). If it would take the
 * active pinned tab off its screen, the new tab is born NOW and the navigation
 * becomes its own, like "Open in new tab" and with the same effect on
 * `screenOwner`: the incoming screen already belongs to the new tab, and the
 * outgoing one stays with the pinned tab until the switch. Called by
 * `instrumentation-client.ts` with path + query already resolved against the
 * document. A navigation the strip itself started is not diverted.
 */
export function divertFromPinned(url: string) {
  if (!state) return;
  const target = normalizeUrl(url);
  if (tabNavigation?.url === target) return;
  const active = state.tabs.find((t) => t.id === state?.active);
  if (!leavesPinned(active, target)) return;
  const { tabs, tab } = withTabAfterPinned(state.tabs, target);
  tabNavigation = { tab: tab.id, url: tab.url };
  publish({ tabs, active: tab.id });
}

/**
 * The document URL changed. Finds out which tab it belongs to and writes it
 * there.
 *
 * With the Navigation API: the owner of the entry the browser is on. A new
 * entry (a push) has no owner yet and goes to the active tab; so does an entry
 * of a closed tab, which becomes the active tab's. Except when the active tab
 * is pinned and the URL is another screen: that is a push that did not go
 * through `divertFromPinned` (a Server Action's `redirect()`), and it goes to
 * a new tab all the same.
 */
export function receiveUrl(url: string) {
  if (!state) return;
  const currentUrl = normalizeUrl(url);
  const key = currentEntryKey();
  const fromTraversal = traversal === currentUrl;
  traversal = null;
  tabNavigation = null;

  let target = state.active;
  let hasOwner = false;
  if (key !== null) {
    const entryOwner = entries[key];
    hasOwner = !!entryOwner && state.tabs.some((t) => t.id === entryOwner);
    if (hasOwner) target = entryOwner;
  } else if (fromTraversal) {
    target = tabShowingUrl(currentUrl) ?? state.active;
  }

  if (
    key !== null &&
    !hasOwner &&
    leavesPinned(
      state.tabs.find((t) => t.id === target),
      currentUrl,
    )
  ) {
    const { tabs, tab } = withTabAfterPinned(state.tabs, currentUrl);
    entries[key] = tab.id;
    publish({ tabs, active: tab.id });
    return;
  }

  if (key !== null) entries[key] = target;
  applyUrl(target, currentUrl);
}

/** Without the Navigation API: the active tab if it already shows the URL,
 *  otherwise the tab showing it that was activated last. */
function tabShowingUrl(url: string): string | null {
  if (!state) return null;
  const active = state.tabs.find((t) => t.id === state?.active);
  if (active?.url === url) return active.id;
  const candidates = state.tabs
    .filter((t) => t.url === url)
    .sort((a, b) => b.activatedAt - a.activatedAt);
  return candidates[0]?.id ?? null;
}

function applyUrl(target: string, url: string) {
  if (!state) return;
  const switched = target !== state.active;
  const tab = state.tabs.find((t) => t.id === target);
  if (!tab) return;
  // A pinned tab a `redirect()` took to another screen keeps its own URL:
  // that is the address it reopens.
  const tabUrl = leavesPinned(tab, url) ? tab.url : url;
  if (!switched && tab.url === tabUrl) {
    // Same URL, but the entry may have just got an owner.
    persist();
    return;
  }
  publish({
    tabs: state.tabs.map((t) =>
      t.id === target
        ? { ...t, url: tabUrl, activatedAt: switched ? Date.now() : t.activatedAt }
        : t,
    ),
    active: target,
  });
}

/**
 * The current history entry now belongs to tab `id`. Used when the activated
 * tab is already at the document URL and no navigation will record it
 * (duplicating the active tab, closing a tab whose neighbor is on the same
 * address).
 */
export function claimCurrentEntry(id: string) {
  const key = currentEntryKey();
  if (key === null) return;
  entries[key] = id;
  persist();
}

// ---------------------------------------------------------------------------
// Operations. Those that change the active tab return the tab to navigate to;
// the navigating is done by `useTabActions`, which has the router.

function withTab(tabs: readonly Tab[], tab: Tab): Tab[] {
  return tabs.map((t) => (t.id === tab.id ? tab : t));
}

/** A new tab, already active. "Open in new tab" puts it right after the
 *  active one, like the browser does with a link (never among the pinned
 *  tabs); the "+" puts it at the end. */
export function openTab(url: string, where: "next" | "end" = "next"): Tab | null {
  if (!state) return null;
  const tab = newTab(url);
  const tabs = [...state.tabs];
  const i = tabs.findIndex((t) => t.id === state?.active);
  if (where === "end" || i < 0) tabs.push(tab);
  else tabs.splice(Math.max(i + 1, pinnedCount(tabs)), 0, tab);
  publish({ tabs, active: tab.id });
  return tab;
}

export function activateTab(id: string): Tab | null {
  if (!state || id === state.active) return null;
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return null;
  const activated = { ...tab, activatedAt: Date.now() };
  publish({ tabs: withTab(state.tabs, activated), active: id });
  return activated;
}

/** The last tab does not close. Closing the active tab activates the one on
 *  its right, otherwise the one on its left. */
export function closeTab(id: string): Tab | null {
  if (!state || state.tabs.length <= 1) return null;
  const i = state.tabs.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const tabs = state.tabs.filter((t) => t.id !== id);
  forgetScreens([id]);
  if (id !== state.active) {
    publish({ tabs, active: state.active });
    return null;
  }
  const neighbor = tabs[i] ?? tabs[i - 1];
  const activated = { ...neighbor, activatedAt: Date.now() };
  publish({ tabs: withTab(tabs, activated), active: activated.id });
  return activated;
}

/** "Close other tabs" and "Close tabs to the right" leave the pinned tabs, as
 *  in the browser. A pinned tab only closes through the menu's "Close tab". */
export function closeOtherTabs(id: string): Tab | null {
  if (!state) return null;
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab) return null;
  const wasActive = id === state.active;
  const activated = wasActive ? tab : { ...tab, activatedAt: Date.now() };
  const stays = (t: Tab) => t.id === id || t.pinned;
  forgetScreens(state.tabs.filter((t) => !stays(t)).map((t) => t.id));
  publish({ tabs: withTab(state.tabs.filter(stays), activated), active: id });
  return wasActive ? null : activated;
}

export function closeTabsToRight(id: string): Tab | null {
  if (!state) return null;
  const i = state.tabs.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const stays = (t: Tab, j: number) => j <= i || t.pinned;
  const tabs = state.tabs.filter(stays);
  forgetScreens(state.tabs.filter((t, j) => !stays(t, j)).map((t) => t.id));
  if (tabs.some((t) => t.id === state?.active)) {
    publish({ tabs, active: state.active });
    return null;
  }
  const activated = { ...state.tabs[i], activatedAt: Date.now() };
  publish({ tabs: withTab(tabs, activated), active: id });
  return activated;
}

/** The copy is born next to the original, already active, with the same URL
 *  and title, and unpinned: the copy of a pinned tab goes right after the
 *  pinned tabs. */
export function duplicateTab(id: string): Tab | null {
  if (!state) return null;
  const i = state.tabs.findIndex((t) => t.id === id);
  if (i < 0) return null;
  const copy: Tab = { ...unpinned(state.tabs[i]), id: newId(), activatedAt: Date.now() };
  // The copy starts with the original's filters and columns, not an empty
  // screen: duplicating means "this again, to change without losing it".
  for (const [k, v] of [...screenMemory]) {
    if (k.startsWith(`${id}${SEP}`)) {
      screenMemory.set(`${copy.id}${k.slice(id.length)}`, v);
    }
  }
  const tabs = [...state.tabs];
  tabs.splice(Math.max(i + 1, pinnedCount(tabs)), 0, copy);
  publish({ tabs, active: copy.id });
  return copy;
}

/** Pinning moves the tab to the end of the pinned group; unpinning, to the
 *  start of the unpinned one: the border between the two in both cases. */
export function pinTab(id: string, pin: boolean) {
  if (!state) return;
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab || !!tab.pinned === pin) return;
  const rest = state.tabs.filter((t) => t.id !== id);
  const tabs = [...rest];
  tabs.splice(pinnedCount(rest), 0, pin ? { ...tab, pinned: true } : unpinned(tab));
  publish({ tabs, active: state.active });
}

/** Longest given name; the tab already truncates past 240px. */
export const MAX_NAME_LENGTH = 60;

/**
 * Names a pinned tab: what identifies it in the strip, in the browser tab and
 * in every new window. An empty name brings back the automatic one
 * (breadcrumb or URL). Unpinned tabs are not renamed: the name would vanish on
 * another window's next F5, and pinned tabs are the ones people keep at hand.
 */
export function renameTab(id: string, name: string) {
  if (!state) return;
  const tab = state.tabs.find((t) => t.id === id);
  if (!tab?.pinned) return;
  const clean = name.trim().replace(/\s+/g, " ").slice(0, MAX_NAME_LENGTH);
  if ((tab.name ?? "") === clean) return;
  const renamed = { ...tab };
  if (clean) renamed.name = clean;
  else delete renamed.name;
  publish({ tabs: withTab(state.tabs, renamed), active: state.active });
}

export function moveTab(id: string, index: number) {
  if (!state) return;
  const from = state.tabs.findIndex((t) => t.id === id);
  if (from < 0) return;
  // Dragging does not cross the border: pinning is done through the menu.
  const n = pinnedCount(state.tabs);
  const [min, max] = state.tabs[from].pinned ? [0, n - 1] : [n, state.tabs.length - 1];
  const to = Math.max(min, Math.min(index, max));
  if (to === from) return;
  const tabs = [...state.tabs];
  const [tab] = tabs.splice(from, 1);
  tabs.splice(to, 0, tab);
  publish({ tabs, active: state.active });
}

// ---------------------------------------------------------------------------
// Each tab's screen
//
// Without `cacheComponents` a navigation to another path remounts the page, and
// `TabScreen` also remounts it on every tab switch (a `key` per owner tab), so
// two tabs on the same path never share an instance. What a screen keeps
// outside the URL survives through `useTabState`, whose value lives here, per
// tab and per path.

const SEP = " ";

function memoryKey(tab: string, path: string, key: string) {
  return `${tab}${SEP}${path}${SEP}${key}`;
}

function forgetScreens(tabs: string[]) {
  for (const tab of tabs) {
    for (const k of [...screenMemory.keys()]) {
      if (k.startsWith(`${tab}${SEP}`)) screenMemory.delete(k);
    }
  }
}

export function readScreenState(
  tab: string,
  path: string,
  key: string,
): { value: unknown } | undefined {
  const k = memoryKey(tab, path, key);
  return screenMemory.has(k) ? { value: screenMemory.get(k) } : undefined;
}

export function writeScreenState(tab: string, path: string, key: string, value: unknown) {
  const tabOwner = state?.tabs.find((t) => t.id === tab);
  if (!tabOwner) return;
  screenMemory.set(memoryKey(tab, path, key), value);
  if (tabOwner.pinned) persistPinned();
}

/** The strip is about to navigate to show tab `tab`; see `screenOwner`. */
export function markTabNavigation(tab: string, url: string) {
  tabNavigation = { tab, url: normalizeUrl(url) };
}

/**
 * Which tab owns the VISIBLE screen, being drawn with this path. Read during
 * render, before commit, so the active tab is not enough:
 *
 * - in a tab switch the active tab changes before the URL does, and the screen
 *   still visible belongs to the previous tab until the navigation lands;
 * - in a Back/Forward the new URL arrives BEFORE `receiveUrl` changes the
 *   active tab, and the owner comes from the history entry (or, without the
 *   Navigation API, from the tab already showing that URL).
 */
export function screenOwner(path: string): string | null {
  if (!state) return null;
  if (tabNavigation) {
    return pathOf(tabNavigation.url) === path
      ? tabNavigation.tab
      : (mountedScreenTab ?? state.active);
  }
  if (traversal !== null && pathOf(traversal) === path) {
    const key = currentEntryKey();
    if (key !== null) {
      const entryOwner = entries[key];
      return entryOwner && state.tabs.some((t) => t.id === entryOwner)
        ? entryOwner
        : state.active;
    }
    return tabShowingUrl(traversal) ?? state.active;
  }
  return state.active;
}

export function confirmMountedScreen(tab: string) {
  mountedScreenTab = tab;
}

/** The tab the page loaded in; `null` before the strip builds the state. */
export function getInitialTab(): string | null {
  return initialTab;
}

// ---------------------------------------------------------------------------
// Title given by the screen

function applyTitle(title: ScreenTitle): boolean {
  if (!state) return false;
  const active = state.tabs.find((t) => t.id === state?.active);
  if (!active || pathOf(active.url) !== title.path) return false;
  if (active.title?.text === title.text && active.title.path === title.path) {
    return false;
  }
  state = { ...state, tabs: withTab(state.tabs, { ...active, title }) };
  return true;
}

/**
 * The visible screen names the active tab (an account page by the account's
 * name). Only while the active tab is still on the screen's path: a tab switch
 * in the middle of loading must not name the wrong tab.
 */
export function setTabTitle(text: string, path: string) {
  const title = { text, path };
  if (!state) {
    pendingTitle = title;
    return;
  }
  if (applyTitle(title)) publish(state);
}

// ---------------------------------------------------------------------------
// Exit

/**
 * Logout: the list leaves `sessionStorage` and memory, so whoever signs in
 * next in this browser starts with a single tab. Pinned tabs stay in
 * `localStorage`, under the owner's key: they come back when that user does.
 */
export function clearTabs() {
  if (sessionKey) {
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {
      // nothing to clear
    }
  }
  state = null;
  owner = null;
  sessionKey = null;
  pinnedKey = null;
  lastPinnedSerial = null;
  lastSessionSerial = null;
  entries = {};
  pendingTitle = null;
  traversal = null;
  tabNavigation = null;
  mountedScreenTab = null;
  initialTab = null;
  screenMemory.clear();
  for (const listener of listeners) listener();
}
