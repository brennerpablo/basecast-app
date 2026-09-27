/**
 * The insight card mounted in JSDOM: the caveat line is always on screen, the figures read by their units,
 * only a headline card carries the accent, and the link is named for the screen behind it.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/", pretendToBeVisual: true });
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
const React = requireAfterDom("react") as typeof import("react");
const { act } = React;
const { createRoot } = requireAfterDom("react-dom/client") as typeof import("react-dom/client");
const { TooltipProvider } = requireAfterDom("@/components/ui/tooltip") as typeof import("@/components/ui/tooltip");
const { InsightCard, topic } = requireAfterDom("./insight-card") as typeof import("./insight-card");

type Insight = import("./insight-card").Insight;

const CARD: Insight = {
  id: "A1",
  grade: "A",
  rank: 1,
  queue: "large_load",
  verified: true,
  link: "/forecast?tab=large-loads",
  title: "Large loads promised vs approved",
  value: 26_836,
  unit: "MW",
  caption: "In October 2024, ERCOT's large-load queue showed 26.8 GW in service by the end of 2025.",
  figures: [
    { label: "Approved to energize, Dec 2025", value: 8_786, unit: "MW" },
    { label: "Approved ÷ promised", value: 0.3274, unit: "ratio" },
  ],
  caveat: "Stock-to-stock from ERCOT's chart labels, not project-level tracking.",
  caveats: [{ code: "machine_read_unverified", label: "Machine-read, not verified", text: "Read by machine." }],
  source_doc: "docs/analysis/q5_large_load.md §3",
};

function mount(node: React.ReactNode): { root: HTMLElement; unmount: () => void } {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(React.createElement(TooltipProvider, null, node)));
  return {
    root: container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

test("a headline card shows its value, figures, caveat, badges and the link to its screen", () => {
  const { root, unmount } = mount(React.createElement(InsightCard, { card: CARD, headline: true }));
  const card = root.querySelector<HTMLElement>("[data-insight='A1']");
  assert.ok(card);
  assert.ok(card.style.borderLeftColor, "a headline card carries the accent");
  assert.ok(root.textContent?.includes("26.8 GW"));
  assert.ok(root.textContent?.includes("A1 · Large-load queue"));
  assert.ok(root.textContent?.includes("8,786 MW"));
  assert.equal(root.querySelector("[data-slot='insight-caveat']")?.textContent, CARD.caveat);
  assert.deepEqual([...root.querySelectorAll("[data-caveat]")].map((b) => b.textContent), ["Machine-read, not verified"]);
  assert.ok(root.textContent?.includes("Re-derived"));
  const link = root.querySelector("a");
  assert.equal(link?.getAttribute("href"), "/forecast?tab=large-loads");
  assert.equal(link?.getAttribute("aria-label"), "Open Forecast");
  unmount();
});

test("a supporting card has no accent, and a card without figures, link or badges still shows its caveat", () => {
  const bare: Insight = { ...CARD, id: "B9", grade: "B", verified: false, link: null, figures: [], caveats: [], source_doc: "" };
  const { root, unmount } = mount(React.createElement(InsightCard, { card: bare }));
  const card = root.querySelector<HTMLElement>("[data-insight='B9']");
  assert.ok(card);
  assert.equal(card.style.borderLeftColor, "");
  assert.equal(root.querySelector("a"), null);
  assert.ok(!root.textContent?.includes("Re-derived"));
  assert.equal(root.querySelector("[data-slot='insight-caveat']")?.textContent, CARD.caveat);
  unmount();
});

test("the icon follows the queue, else the screen behind the card", () => {
  assert.equal(topic({ queue: "generation", link: "/explorer?layer=queue" }), "generation");
  assert.equal(topic({ queue: null, link: "/forecast?tab=4cp" }), "4cp");
  assert.equal(topic({ queue: null, link: "/backtest" }), "backtest");
  assert.equal(topic({ queue: null, link: null }), "other");
});
