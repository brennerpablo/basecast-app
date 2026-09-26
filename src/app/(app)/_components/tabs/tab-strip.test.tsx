/**
 * Typing in a filter that lives in the URL does not re-render every tab.
 *
 * The strip reads `useSearchParams()`, so it renders on every URL change, and
 * again when the effect hands the URL to the store and it publishes. Without
 * memo, the N tabs rendered twice per keystroke. With the item memoized, only
 * the tab whose URL changed renders: the others keep their store object and
 * every prop.
 *
 * Real store; the tab's drawing (`TabItem`) is a probe that counts.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.IS_REACT_ACT_ENVIRONMENT = true;
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in g) continue;
  try {
    g[key] = (dom.window as unknown as Record<string, unknown>)[key];
  } catch {
    // Getters that throw outside a real browser; irrelevant here.
  }
}

const requireAfterDom = createRequire(__filename);

function stubModule(specifier: string, exports: Record<string, unknown>): void {
  const id = requireAfterDom.resolve(specifier);
  requireAfterDom.cache[id] = { id, filename: id, loaded: true, exports } as unknown as NodeJS.Module;
}

const React = requireAfterDom("react") as typeof import("react");
const { act } = React;
const { createRoot } = requireAfterDom("react-dom/client") as typeof import("react-dom/client");

/** The "browser" URL: what `usePathname`/`useSearchParams` return. */
let path = "/";
let search = "";
const ROUTER = { push: () => {}, replace: () => {} };
stubModule("next/navigation", {
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ROUTER,
});

/** Renders of each tab, by id. */
const renders = new Map<string, number>();
stubModule("./tab-visual", {
  TabList: ({ children }: { children: React.ReactNode }) => React.createElement("div", null, children),
  NewTabButton: () => null,
  useDragScope: () => React.useState(() => Symbol("app-tab"))[0],
  TabItem: ({ id }: { id: string }) => {
    renders.set(id, (renders.get(id) ?? 0) + 1);
    return null;
  },
});
stubModule("@/components/tabs/link-menu", { copyLink: async () => {} });

const store = requireAfterDom("@/lib/tabs/tabs-store") as typeof import("@/lib/tabs/tabs-store");
const { TabStrip } = requireAfterDom("./tab-strip") as typeof import("./tab-strip");

test("typing in a URL filter renders only the active tab", async () => {
  store.clearTabs();
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  const render = () => act(async () => root.render(React.createElement(TabStrip, { owner: "u1" })));
  try {
    path = "/accounts";
    await render();
    // Five tabs; the last one opened is active, and the "browser" is on it.
    for (const url of ["/explorer", "/forecast", "/backtest", "/data"]) {
      await act(async () => {
        store.openTab(url, "end");
      });
    }
    path = "/data";
    await render();
    const state = store.getTabs()!;
    assert.equal(state.tabs.length, 5);
    const active = state.active;

    renders.clear();
    for (const q of ["a", "ab", "abc"]) {
      search = `q=${q}`;
      await render();
    }

    assert.equal(store.getTabs()!.tabs.find((t) => t.id === active)!.url, "/data?q=abc");
    const others = [...renders.entries()].filter(([id]) => id !== active);
    assert.deepEqual(others, [], "the tabs that did not change do not render");
    assert.equal(renders.get(active), 3, "the active tab renders once per new URL");
  } finally {
    await act(async () => root.unmount());
    store.clearTabs();
  }
});
