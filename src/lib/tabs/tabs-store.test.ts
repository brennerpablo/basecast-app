import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";

import {
  activateTab,
  clearTabs,
  closeOtherTabs,
  closeTab,
  divertFromPinned,
  duplicateTab,
  getInitialTab,
  getTabs,
  initTabs,
  markTabNavigation,
  openTab,
  pinTab,
  readScreenState,
  receiveUrl,
  renameTab,
  screenOwner,
  setTabTitle,
  writeScreenState,
} from "./tabs-store";

/** In-memory `Storage`: the store only uses get/set/remove. */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

const g = globalThis as unknown as Record<string, unknown>;
let session: MemoryStorage;
let local: MemoryStorage;

const SESSION_KEY = "basecast.tabs.u1";
const PINNED_KEY = "basecast.pinned-tabs.u1";

/** A window without the Navigation API, with `n` history entries. */
function browserWindow(history = 1) {
  session = new MemoryStorage();
  g.sessionStorage = session;
  g.window = { history: { length: history }, location: { pathname: "/", search: "" } };
}

/** Turns on the Navigation API in the current window; `go` changes the
 *  current entry. */
function fakeNavigation(first: string) {
  const keys = [first];
  const nav = {
    currentEntry: { key: first },
    entries: () => keys.map((key) => ({ key })),
  };
  (g.window as Record<string, unknown>).navigation = nav;
  return {
    go(key: string) {
      if (!keys.includes(key)) keys.push(key);
      nav.currentEntry = { key };
    },
  };
}

beforeEach(() => {
  clearTabs();
  local = new MemoryStorage();
  g.localStorage = local;
  browserWindow();
});

const tabs = () => getTabs()!.tabs;
const active = () => getTabs()!.tabs.find((t) => t.id === getTabs()!.active)!;

test("starts with one tab, the arrival URL's", () => {
  assert.equal(initTabs("u1", "/forecast?zone=north"), true);
  assert.equal(tabs().length, 1);
  assert.equal(active().url, "/forecast?zone=north");
  assert.equal(getInitialTab(), active().id);
  // Already built: the caller goes on with `receiveUrl`.
  assert.equal(initTabs("u1", "/"), false);
});

test("the URL belongs to the active tab", () => {
  initTabs("u1", "/explorer");
  const second = openTab("/accounts")!;
  receiveUrl("/accounts?q=x");
  assert.equal(active().id, second.id);
  assert.equal(active().url, "/accounts?q=x");
  assert.equal(tabs()[0].url, "/explorer");
});

test("the last tab does not close, and closing the active one activates the right one", () => {
  initTabs("u1", "/a");
  assert.equal(closeTab(tabs()[0].id), null);
  const b = openTab("/b", "end")!;
  const c = openTab("/c", "end")!;
  activateTab(b.id);
  const neighbor = closeTab(b.id);
  assert.equal(neighbor?.id, c.id);
  assert.deepEqual(
    tabs().map((t) => t.url),
    ["/a", "/c"],
  );
});

test("a pinned tab goes left, survives 'close others' and comes back in a new window", () => {
  initTabs("u1", "/a");
  const b = openTab("/b", "end")!;
  pinTab(b.id, true);
  assert.equal(tabs()[0].id, b.id);
  closeOtherTabs(tabs()[1].id);
  assert.ok(tabs().some((t) => t.id === b.id));

  // New window (one history entry): only the pinned tabs + the URL's.
  clearTabs();
  browserWindow(1);
  initTabs("u1", "/c");
  assert.deepEqual(
    tabs().map((t) => [t.url, !!t.pinned]),
    [
      ["/b", true],
      ["/c", false],
    ],
  );
});

test("a pinned tab never leaves its screen: another path opens a new tab", () => {
  initTabs("u1", "/a");
  const p = active().id;
  openTab("/b", "end");
  pinTab(p, true);
  activateTab(p);
  receiveUrl("/a");

  // A menu item clicked on the pinned tab: the new tab is born before the
  // navigation, right after the pinned ones, and the incoming screen is its.
  divertFromPinned("/accounts?q=x");
  const created = active();
  assert.equal(created.url, "/accounts?q=x");
  assert.deepEqual(
    tabs().map((t) => t.url),
    ["/a", "/accounts?q=x", "/b"],
  );
  assert.equal(screenOwner("/accounts"), created.id);
  assert.equal(screenOwner("/a"), p);
  receiveUrl("/accounts?q=x");
  assert.equal(active().id, created.id);
  assert.equal(tabs()[0].url, "/a");
});

test("on a pinned tab the query changes and is stored; the path does not", () => {
  initTabs("u1", "/accounts");
  pinTab(active().id, true);
  divertFromPinned("/accounts?status=open");
  receiveUrl("/accounts?status=open");
  assert.equal(tabs().length, 1);
  assert.equal(active().url, "/accounts?status=open");
});

test("a pinned tab's redirect changes neither its URL nor opens a tab", () => {
  initTabs("u1", "/a");
  pinTab(active().id, true);
  // `redirect()` is `replace`: it does not go through `divertFromPinned`.
  receiveUrl("/sign-in");
  assert.equal(tabs().length, 1);
  assert.equal(active().url, "/a");
  assert.equal(active().pinned, true);
});

test("with the Navigation API: a new entry over a pinned tab becomes a new tab, and Back returns to it", () => {
  const nav = fakeNavigation("k1");
  initTabs("u1", "/a");
  const p = active().id;
  pinTab(p, true);

  // A push that did not go through `divertFromPinned` (a Server Action's
  // `redirect()`): an entry with no owner, another path.
  nav.go("k2");
  receiveUrl("/b");
  assert.deepEqual(
    tabs().map((t) => [t.url, !!t.pinned]),
    [
      ["/a", true],
      ["/b", false],
    ],
  );
  assert.equal(active().url, "/b");

  nav.go("k1");
  receiveUrl("/a");
  assert.equal(active().id, p);
  // A `replace` to another path keeps the key: it is the pinned tab's, and it
  // does not change it.
  receiveUrl("/redirected");
  assert.equal(active().id, p);
  assert.equal(active().url, "/a");
  assert.equal(tabs().length, 2);
});

test("a full load on top of a pinned tab opens a new tab; the pinned one keeps its URL", () => {
  initTabs("u1", "/a");
  pinTab(active().id, true);
  const stored = session.getItem(SESSION_KEY);
  clearTabs();
  browserWindow(2);
  session.setItem(SESSION_KEY, stored!);
  initTabs("u1", "/b");
  assert.deepEqual(
    tabs().map((t) => [t.url, !!t.pinned]),
    [
      ["/a", true],
      ["/b", false],
    ],
  );
  assert.equal(active().url, "/b");
});

test("the list is per owner: another owner starts from scratch", () => {
  initTabs("u1", "/a");
  openTab("/b", "end");
  // Logout: `clearTabs` before the next person signs in.
  clearTabs();
  browserWindow(3);
  initTabs("u2", "/");
  assert.equal(tabs().length, 1);
  assert.equal(session.getItem(SESSION_KEY), null);
});

test("F5 on the same browser tab restores the whole list", () => {
  initTabs("u1", "/a");
  openTab("/b", "end");
  const stored = session.getItem(SESSION_KEY);
  clearTabs();
  browserWindow(2);
  session.setItem(SESSION_KEY, stored!);
  initTabs("u1", "/b");
  assert.deepEqual(
    tabs().map((t) => t.url),
    ["/a", "/b"],
  );
});

test("during a tab switch the visible screen still belongs to the previous tab", () => {
  initTabs("u1", "/a");
  const first = active().id;
  const b = openTab("/b", "end")!;
  // It reached /b through the strip; /b's screen is b's.
  receiveUrl("/b");
  assert.equal(screenOwner("/b"), b.id);
  // Back to the first: the active tab changes before the URL does.
  const target = activateTab(first)!;
  markTabNavigation(target.id, target.url);
  assert.equal(screenOwner("/a"), first);
  // The initial tab is still the one the page loaded in.
  assert.equal(getInitialTab(), first);
});

test("screen state is per tab and per path, and duplicating copies it", () => {
  initTabs("u1", "/accounts");
  const a = active().id;
  writeScreenState(a, "/accounts", "filters", { q: "x" });
  assert.deepEqual(readScreenState(a, "/accounts", "filters"), { value: { q: "x" } });
  assert.equal(readScreenState(a, "/other", "filters"), undefined);
  const copy = duplicateTab(a)!;
  assert.deepEqual(readScreenState(copy.id, "/accounts", "filters"), { value: { q: "x" } });
  closeTab(a);
  assert.equal(readScreenState(a, "/accounts", "filters"), undefined);
});

test("a pinned tab carries the screen filters of its path: new window and F5", () => {
  initTabs("u1", "/accounts?status=open");
  const p = active().id;
  pinTab(p, true);
  const from = new Date("2026-09-01T03:00:00.000Z");
  writeScreenState(p, "/accounts", "data-table::r1:filters", [
    { id: "type", value: ["coop"] },
    { id: "created", value: { from, to: undefined } },
  ]);
  // Another path the tab went through stays in this window's memory only.
  writeScreenState(p, "/other", "filters", { q: "x" });

  // New window: the pinned tab comes back with the URL AND the filters.
  clearTabs();
  browserWindow(1);
  initTabs("u1", "/");
  const pinned = tabs().find((t) => t.pinned)!;
  assert.equal(pinned.url, "/accounts?status=open");
  const back = readScreenState(pinned.id, "/accounts", "data-table::r1:filters");
  assert.deepEqual(back, {
    value: [
      { id: "type", value: ["coop"] },
      { id: "created", value: { from } },
    ],
  });
  // The `Date` comes back a `Date`, not text: a date filter would break.
  const created = (back!.value as { value: { from: unknown } }[])[1].value.from;
  assert.ok(created instanceof Date);
  assert.equal(readScreenState(pinned.id, "/other", "filters"), undefined);

  // F5 on the same browser tab clears the memory; the pinned tab keeps its filter.
  const stored = session.getItem(SESSION_KEY);
  clearTabs();
  browserWindow(2);
  session.setItem(SESSION_KEY, stored!);
  initTabs("u1", "/");
  assert.ok(readScreenState(pinned.id, "/accounts", "data-table::r1:filters"));
});

test("an unpinned tab does not write screen state to localStorage", () => {
  initTabs("u1", "/accounts");
  writeScreenState(active().id, "/accounts", "filters", { q: "x" });
  assert.ok(!(local.getItem(PINNED_KEY) ?? "").includes("filters"));
});

test("two windows: a gesture on one pinned tab does not undo the filter the other window set on another", () => {
  // Window A pins two tabs; window B opens later and gets them.
  initTabs("u1", "/a");
  const pa = active().id;
  pinTab(pa, true);
  const pb = openTab("/b", "end")!.id;
  pinTab(pb, true);

  // B: another window reads what A stored and filters the pinned /a.
  clearTabs();
  browserWindow(1);
  initTabs("u1", "/");
  writeScreenState(pa, "/a", "filters", { q: "from-B" });
  const fromB = local.getItem(PINNED_KEY)!;

  // A takes over again (its state restored from sessionStorage, pinned tabs as
  // it read them before B's filter) and touches only the pinned /b.
  clearTabs();
  browserWindow(2);
  const stateOfA = JSON.stringify({
    v: 1,
    tabs: [
      { id: pa, url: "/a", activatedAt: 1, pinned: true },
      { id: pb, url: "/b", activatedAt: 2, pinned: true },
    ],
    active: pb,
    entries: {},
  });
  session.setItem(SESSION_KEY, stateOfA);
  const withoutFilter = (JSON.parse(fromB) as { screens?: unknown }[]).map(
    ({ screens: _, ...p }) => p,
  );
  local.setItem(PINNED_KEY, JSON.stringify(withoutFilter));
  initTabs("u1", "/b");
  local.setItem(PINNED_KEY, fromB); // B wrote after A had read
  receiveUrl("/b?x=1");

  const stored = JSON.parse(local.getItem(PINNED_KEY)!) as {
    id: string;
    url: string;
    screens?: Record<string, unknown>;
  }[];
  assert.deepEqual(stored.find((p) => p.id === pa)!.screens, { filters: { q: "from-B" } });
  assert.equal(stored.find((p) => p.id === pb)!.url, "/b?x=1");
});

test("only a pinned tab is renamed; the name comes back in a new window and leaves on unpin", () => {
  initTabs("u1", "/accounts");
  const a = active().id;
  renameTab(a, "My co-ops");
  assert.equal(active().name, undefined);

  pinTab(a, true);
  renameTab(a, "  My   co-ops  ");
  assert.equal(active().name, "My co-ops");
  // The given name holds on any path, unlike the screen's title.
  receiveUrl("/forecast");
  assert.equal(active().name, "My co-ops");

  clearTabs();
  browserWindow(1);
  initTabs("u1", "/");
  const pinned = tabs().find((t) => t.pinned)!;
  assert.equal(pinned.name, "My co-ops");

  // Empty brings back the automatic name; so does unpinning.
  renameTab(pinned.id, "   ");
  assert.equal(tabs().find((t) => t.id === pinned.id)!.name, undefined);
  renameTab(pinned.id, "Again");
  pinTab(pinned.id, false);
  assert.equal(tabs().find((t) => t.id === pinned.id)!.name, undefined);
});

test("a URL that changes nothing does not rewrite sessionStorage", () => {
  initTabs("u1", "/accounts");
  let writes = 0;
  const setItem = session.setItem.bind(session);
  session.setItem = (k: string, v: string) => {
    writes += 1;
    setItem(k, v);
  };

  // The same URL arrives again (the strip's effect runs on each of its
  // renders) and the same screen title: nothing stored changed.
  for (let i = 0; i < 5; i++) receiveUrl("/accounts");
  setTabTitle("Accounts", "/accounts");
  const afterTitle = writes;
  setTabTitle("Accounts", "/accounts");
  assert.equal(writes, afterTitle, "the same title does not write");
  assert.equal(afterTitle, 1, "only the new title wrote");

  // A new URL writes once.
  receiveUrl("/accounts?q=a");
  assert.equal(writes, 2);
  assert.equal(JSON.parse(session.getItem(SESSION_KEY)!).tabs[0].url, "/accounts?q=a");

  // After clearing, the same window writes from scratch again.
  clearTabs();
  initTabs("u1", "/accounts?q=a");
  assert.equal(writes, 3);
});
