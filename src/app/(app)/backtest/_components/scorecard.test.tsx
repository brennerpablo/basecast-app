/**
 * The backtest scorecard mounted in JSDOM, on numbers trimmed from get-data's real `/backtest/peak` and
 * `/backtest/queue`: the peak MAPE against ERCOT's, the head-to-head by era, the bias, the band coverage against
 * its 80% target and the queue's rank check, orange where the model falls short.
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
const { BacktestScorecard } = requireAfterDom("./scorecard") as typeof import("./scorecard");

type PeakData = import("./backtest-data").PeakData;
type QueueData = import("./backtest-data").QueueData;

const score = (era: string, source: string, mape: number, bias_pct: number, coverage: number | null = null) => ({
  era,
  source,
  n: 1,
  mape,
  bias_pct,
  coverage,
});
const pair = (era: string, official_source: string, basecast_mape: number, official_mape: number) => ({
  era,
  official_source,
  n: 1,
  basecast_mape,
  official_mape,
  basecast_bias_pct: 0,
  official_bias_pct: 0,
});

const PEAK = {
  eras: [
    { era: "before_tsp_loads", label: "Before TSP large loads", description: "" },
    { era: "with_tsp_loads", label: "With TSP large loads", description: "" },
  ],
  scores: [
    score("all", "basecast", 3.299, -1.802, 0.5556),
    score("all", "LTLF", 5.064, 2.824),
    score("all", "CDR", 4.808, 1.888),
  ],
  comparisons: [
    pair("all", "LTLF", 3.299, 5.064),
    pair("before_tsp_loads", "CDR", 3.374, 2.817),
    pair("before_tsp_loads", "LTLF", 3.491, 2.744),
    pair("with_tsp_loads", "CDR", 3.081, 7.084),
    pair("with_tsp_loads", "LTLF", 3.059, 7.963),
    pair("with_tsp_loads", "LTLF-prelim", 2.301, 22.896),
  ],
} as unknown as PeakData;

const QUEUE: QueueData = {
  items: [["2022-06-01", -13.22], ["2023-01-01", 9.29], ["2024-08-01", 1.35]].map(([report_month, error_pct]) => ({
    report_month: report_month as string,
    stratum: "all",
    window_months: 24,
    raw_mw: 1,
    pred_mw: 1,
    actual_mw: 1,
    developer_projected_mw: null,
    error_pct: error_pct as number,
    model_variant: "entry_ia_sm|mw",
  })),
  county_rank: [{ report_month: "2024-08-01", rho_adj: 0.642, rho_raw: 0.454, rho_developer: 0.565 }],
};

async function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(node));
  return {
    container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

/** Each card's title, value and hint, and whether it carries the alert accent. */
function cards(container: HTMLElement) {
  return [...container.querySelectorAll<HTMLElement>(":scope > div > div")].map((card) => ({
    text: card.textContent ?? "",
    alert: (card.getAttribute("style") ?? "").includes("249, 115, 22") || (card.outerHTML.includes("#f97316")),
  }));
}

test("the scorecard reads the real backtest: better than ERCOT overall, short in the older era and in coverage", async () => {
  const { container, unmount } = await mount(
    React.createElement(BacktestScorecard, { peak: PEAK, queue: QUEUE, loading: { peak: false, queue: false } }),
  );
  const [mape, wins, bias, coverage, queue] = cards(container);

  assert.match(mape.text, /Peak MAPE3\.3%LTLF 5\.1% · CDR 4\.8%/);
  assert.equal(mape.alert, false);

  assert.match(wins.text, /3 of 5/);
  assert.match(wins.text, /Before TSP large loads 0\/2 · With TSP large loads 3\/3/);
  assert.equal(wins.alert, true);

  assert.match(bias.text, /-1\.8%Runs low · LTLF \+2\.8% · CDR \+1\.9%/);

  assert.match(coverage.text, /55\.6%Target 80\.0% inside P10–P90|56%Target 80% inside P10–P90/);
  assert.equal(coverage.alert, true);

  assert.match(queue.text, /0\.64Raw queue 0\.45 · 24-month error 8\.0%/);
  assert.equal(queue.alert, false);
  unmount();
});

test("a response that failed shows gaps, not a skeleton forever", async () => {
  const { container, unmount } = await mount(
    React.createElement(BacktestScorecard, { peak: undefined, queue: undefined, loading: { peak: false, queue: false } }),
  );
  assert.equal(container.querySelectorAll("[data-slot=skeleton]").length, 0);
  assert.match(container.textContent ?? "", /Peak MAPE—/);
  unmount();
});
