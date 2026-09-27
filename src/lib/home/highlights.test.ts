import assert from "node:assert/strict";
import { test } from "node:test";

import type { AccountSummary } from "@/lib/accounts/labels";
import type { components } from "@/lib/api/get-data";
import type { CountyRow } from "@/lib/explorer/layers";

import { backtestEdge, callFirst, leadInsight, nextLapses, nextSummer, peakRows, topCounties } from "./highlights";

type PeakForecastData = components["schemas"]["PeakForecastData"];
type PeakBacktestData = components["schemas"]["PeakBacktestData"];
type Insight = components["schemas"]["InsightCard"];

const account = (id: string, rank: number, action: AccountSummary["next_action"], changesOn: string | null = null) =>
  ({ account_id: id, rank, next_action: action, action_changes_on: changesOn }) as AccountSummary;

test("the lead insight is the first grade A card, else the first card", () => {
  const card = (id: string, grade: string) => ({ id, grade }) as Insight;
  assert.equal(leadInsight([card("B1", "B"), card("A2", "A"), card("A1", "A")])?.id, "A2");
  assert.equal(leadInsight([card("B1", "B"), card("C1", "C")])?.id, "B1");
  assert.equal(leadInsight([]), undefined);
});

test("call first keeps call_now accounts in rank order", () => {
  const items = [account("c", 7, "call_now"), account("a", 1, "nurture"), account("b", 3, "call_now"), account("d", 9, "call_now")];
  assert.deepEqual(
    callFirst(items, 2).map((a) => a.account_id),
    ["b", "c"],
  );
});

test("the next lapses start on the data date, soonest first, ties by rank", () => {
  const items = [
    account("past", 1, "call_now", "2026-09-01"),
    account("late", 2, "watch", "2026-12-01"),
    account("tie-b", 8, "call_now", "2026-10-22"),
    account("tie-a", 4, "nurture", "2026-10-22"),
    account("none", 3, "hold"),
  ];
  assert.deepEqual(
    nextLapses(items, "2026-09-26", 5).map((a) => a.account_id),
    ["tie-a", "tie-b", "late"],
  );
  assert.equal(nextLapses(items, null, 5).length, 4);
});

test("the top counties are ERCOT counties with a score, by the acquisition rank", () => {
  const row = (fips: string, rank: number | null, inErcot = true) =>
    ({ county_fips: fips, in_ercot: inErcot, acquisition: rank === null ? null : { rank } }) as CountyRow;
  const rows = [row("3", 3), row("1", 1), row("x", null), row("0", 0, false), row("2", 2)];
  assert.deepEqual(
    topCounties(rows, 2).map((r) => r.county_fips),
    ["1", "2"],
  );
});

const peak = {
  series: [
    { target_year: 2028, p10_mw: 94_000, p50_mw: 98_000, p90_mw: 104_000 },
    { target_year: 2027, p10_mw: 89_000, p50_mw: 92_800, p90_mw: 96_400 },
  ],
  official: [
    { target_year: 2027, series: "cdr", mw: 105_400, label: "CDR" },
    { target_year: 2027, series: "ercot_adjusted", mw: 104_300, label: "LTLF" },
    { target_year: 2028, series: "tsp_provided", mw: 173_000, label: "TSP" },
  ],
} as unknown as PeakForecastData;

test("the next summer is the first forecast year against ERCOT's adjusted line", () => {
  const next = nextSummer(peak);
  assert.equal(next?.point.target_year, 2027);
  assert.equal(next?.official?.label, "LTLF");
  assert.equal(next?.gapMw, 92_800 - 104_300);
  assert.equal(nextSummer({ ...peak, series: [] }), null);
});

test("the peak rows carry the band as a pair and the adjusted line only", () => {
  assert.deepEqual(peakRows(peak), [
    { year: 2027, p50: 92_800, band: [89_000, 96_400], official: 104_300 },
    { year: 2028, p50: 98_000, band: [94_000, 104_000], official: undefined },
  ]);
});

test("the backtest headline is the latest era's official source scored on the most dates", () => {
  const cmp = (era: string, source: string, n: number) => ({ era, official_source: source, n, basecast_mape: 3, official_mape: 5 });
  const data = {
    eras: [{ era: "before" }, { era: "with" }],
    comparisons: [cmp("all", "LTLF", 18), cmp("with", "CDR", 7), cmp("with", "LTLF", 8), cmp("with", "LTLF-prelim", 1), cmp("before", "LTLF", 10)],
  } as unknown as PeakBacktestData;
  const { headline, rows } = backtestEdge(data);
  assert.equal(headline?.era, "with");
  assert.equal(headline?.official_source, "LTLF");
  assert.deepEqual(
    rows.map((r) => `${r.era}:${r.official_source}`),
    ["before:LTLF", "with:LTLF", "with:CDR", "with:LTLF-prelim"],
  );
});
