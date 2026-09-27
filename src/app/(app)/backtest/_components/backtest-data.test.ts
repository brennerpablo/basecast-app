/**
 * The backtest screen's readings of the API: families and labels of sources, the nice axis scale, the
 * fan's marks and what the selected date used, cells by target year, the matrix views and error bins,
 * and the queue layout. Rows are trimmed from get-data's real `/backtest/*` answers.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  type Cell,
  errorBin,
  errorMatrix,
  family,
  fanParts,
  type FanPoint,
  groupByTarget,
  inView,
  modelAt,
  niceScale,
  type OfficialError,
  officialsInUse,
  orderCells,
  productViews,
  queueLayout,
  type QueueRow,
  scoresByEra,
  sourceLabel,
  yearTicks,
} from "./backtest-data";
import { binFill, inkOn } from "./palette";

const cell = (over: Partial<Cell>): Cell => ({
  as_of: "2026-05-31",
  target_year: 2026,
  horizon: 1,
  source: "basecast",
  era: "with_tsp_loads",
  p50_mw: 89037.1,
  actual_mw: 91133.7,
  actual_final: false,
  verified: true,
  ...over,
});

const fanPoint = (over: Partial<FanPoint>): FanPoint => ({
  kind: "official",
  label: "x",
  source: "official_forecasts",
  method: "file",
  final: true,
  verified: true,
  ...over,
});

test("a hyphenated edition belongs to its product's family; ours and the ablation are their own", () => {
  assert.equal(family("LTLF-prelim"), "LTLF");
  assert.equal(family("CDR"), "CDR");
  assert.equal(family("basecast"), "basecast");
  assert.equal(family("basecast_organic_only"), "organic");
  assert.equal(family("EIA"), "other");
  assert.equal(sourceLabel("basecast_organic_only"), "basecast, organic only");
  assert.equal(sourceLabel("LTLF"), "LTLF");
});

test("the MW axis snaps to a nice step and covers every value", () => {
  const { domain, ticks } = niceScale([78571.5, 112000, 91133.7, 86035.4]);
  assert.deepEqual(domain, [70000, 120000]);
  assert.deepEqual(ticks, [70000, 80000, 90000, 100000, 110000, 120000]);
  assert.deepEqual(niceScale([]).domain, [0, 1]);
});

test("year ticks fall on January 1, every other year when asked", () => {
  const ticks = yearTicks(Date.UTC(2016, 0, 1), Date.UTC(2020, 5, 1), 2);
  assert.deepEqual(
    ticks.map((t) => new Date(t).toISOString().slice(0, 10)),
    ["2017-01-01", "2019-01-01"],
  );
});

test("the fan splits into its kinds, models by date, and the selected date's model and officials are found", () => {
  const fan = [
    fanPoint({ kind: "model", label: "basecast as of 2026-05-31", vintage: "2026-05-31", vintage_date: "2026-05-31", value_mw: 89037.1 }),
    fanPoint({ kind: "official", label: "LTLF 2025, ERCOT-adjusted", product: "LTLF", vintage: "LTLF 2025", vintage_date: "2025-04-08", value_mw: 94650.257 }),
    fanPoint({ kind: "official", label: "LTLF 2025, TSP-provided", product: "LTLF", vintage: "LTLF 2025", vintage_date: "2025-04-08", value_mw: 109031.492 }),
    fanPoint({ kind: "official_preliminary", label: "2026 preliminary LTLF", product: "LTLF-prelim", vintage: "2026 preliminary LTLF", vintage_date: "2026-04-15", value_mw: 112000 }),
    fanPoint({ kind: "official_range", label: "range", vintage_date: "2026-04-15", low_mw: 90500, high_mw: 98000 }),
    fanPoint({ kind: "actual", label: "Actual", value_mw: 91133.7, final: false }),
    fanPoint({ kind: "model", label: "basecast as of 2023-05-31", vintage: "2023-05-31", vintage_date: "2023-05-31", value_mw: 84314.4 }),
  ];
  const parts = fanParts(fan);
  assert.equal(parts.officials.length, 2);
  assert.equal(parts.range?.low_mw, 90500);
  assert.deepEqual(parts.models.map((m) => m.vintage_date), ["2023-05-31", "2026-05-31"]);
  assert.equal(modelAt(parts.models, "2026-05-31")?.value_mw, 89037.1);

  const cells = [
    cell({ source: "LTLF", vintage: "LTLF 2025", p50_mw: 94650.257 }),
    cell({ source: "LTLF-prelim", vintage: "2026 preliminary LTLF", p50_mw: 112000 }),
    cell({ source: "CDR", vintage: "CDR Dec 2025", p50_mw: 95419.4, target_year: 2027 }),
  ];
  const used = officialsInUse(fan, cells, 2026);
  // The ERCOT-adjusted series, not the TSP-provided one of the same vintage.
  assert.deepEqual([...used].map((p) => p.label).sort(), ["2026 preliminary LTLF", "LTLF 2025, ERCOT-adjusted"]);
});

test("cells group by target year: the model, its ablation, then the officials by publication date", () => {
  const groups = groupByTarget([
    cell({ source: "LTLF", vintage: "LTLF 2023", vintage_date: "2023-01-18", target_year: 2024, horizon: 2, actual_final: true }),
    cell({ source: "basecast_organic_only", target_year: 2024, horizon: 2, actual_final: true }),
    cell({ source: "CDR", vintage: "CDR May 2023", vintage_date: "2023-05-01", target_year: 2024, horizon: 2, actual_final: true }),
    cell({ source: "basecast", target_year: 2024, horizon: 2, actual_final: true }),
    cell({ source: "basecast", target_year: 2026, horizon: 4 }),
  ]);
  assert.deepEqual(groups.map((g) => [g.targetYear, g.horizon, g.actualFinal]), [[2024, 2, true], [2026, 4, false]]);
  assert.deepEqual(orderCells(groups[0]).map((c) => c.source), ["basecast", "basecast_organic_only", "LTLF", "CDR"]);
});

test("scores go by era in the API's order with `all` last, ours first inside each", () => {
  const eras = [
    { era: "before_tsp_loads", label: "Before", description: "" },
    { era: "with_tsp_loads", label: "With", description: "" },
  ];
  const score = (era: string, source: string) => ({ era, source, n: 1, mape: 1, bias_pct: 0 });
  const grouped = scoresByEra(
    [score("all", "LTLF"), score("with_tsp_loads", "CDR"), score("with_tsp_loads", "basecast"), score("before_tsp_loads", "LTLF")],
    eras,
  );
  assert.deepEqual(grouped.map(([era]) => era), ["before_tsp_loads", "with_tsp_loads", "all"]);
  assert.deepEqual(grouped[1][1].map((s) => s.source), ["basecast", "CDR"]);
});

test("the matrix offers each product once, a preliminary edition inside its product's view", () => {
  assert.deepEqual(productViews(["CDR", "LTLF", "LTLF-prelim"]), ["CDR", "LTLF"]);
  assert.ok(inView("LTLF-prelim", "LTLF"));
  assert.ok(!inView("CDR", "LTLF"));

  const item = (over: Partial<OfficialError>): OfficialError => ({
    product: "LTLF",
    vintage: "LTLF 2024",
    vintage_date: "2024-07-18",
    target_year: 2026,
    horizon: 2,
    forecast_mw: 106405,
    actual_complete: false,
    error_pct: 16.76,
    ...over,
  });
  const { rows, years } = errorMatrix(
    [
      item({}),
      item({ target_year: 2025, horizon: 1, error_pct: 8.08, actual_complete: true }),
      item({ product: "LTLF-prelim", vintage: "2026 preliminary LTLF", vintage_date: "2026-04-15", horizon: 1, error_pct: 22.9 }),
      item({ product: "CDR", vintage: "CDR Dec 2025", vintage_date: "2025-12-01" }),
      item({ vintage: "LTLF 2023", vintage_date: "2023-01-18", target_year: 2023, horizon: 1, error_pct: -3.74 }),
    ],
    "LTLF",
  );
  assert.deepEqual(years, [2023, 2025, 2026]);
  assert.deepEqual(rows.map((r) => r.vintage), ["LTLF 2023", "LTLF 2024", "2026 preliminary LTLF"]);
  assert.equal(rows[1].byYear.get(2025)?.error_pct, 8.08);
});

test("errors bin by size and sign; the label ink contrasts with its cell", () => {
  assert.equal(errorBin(1.9), 0);
  assert.equal(errorBin(-2), -1);
  assert.equal(errorBin(7.5), 2);
  assert.equal(errorBin(-22.9), -3);
  assert.equal(errorBin(null), null);
  assert.equal(inkOn(binFill(3, "light")), "#ffffff");
  assert.equal(inkOn(binFill(0, "light")), "#0b0b0b");
  assert.equal(inkOn(binFill(-3, "dark")), "#0b0b0b");
});

test("the queue lays out report months in order and `all` first among the strata", () => {
  const row = (report_month: string, stratum: string): QueueRow => ({
    report_month,
    stratum,
    window_months: 24,
    raw_mw: 1,
    pred_mw: 1,
    actual_mw: 1,
    error_pct: 0,
  });
  const { months, strata } = queueLayout([row("2023-01-01", "solar"), row("2022-06-01", "wind"), row("2022-06-01", "all")]);
  assert.deepEqual(months, ["2022-06-01", "2023-01-01"]);
  assert.deepEqual(strata, ["all", "solar", "wind"]);
});
