import assert from "node:assert/strict";
import { test } from "node:test";

import type { CountyRow } from "./layers";
import { acquisitionSummary, dataCenterSummary, queueSummary, rankedCounties } from "./summary";

const row = (fips: string, extra: Partial<CountyRow> = {}): CountyRow => ({
  county_fips: fips,
  county_name: `County ${fips}`,
  weather_zone: "NCENT",
  in_ercot: true,
  acquisition: null,
  queue: null,
  data_centers: { sites: 0, sites_naics_only: 0, sites_outside_ercot: 0 },
  ...extra,
});

const acq = (rank: number, cls: number, retail: number | null, partner: number | null) =>
  ({ rank, priority_class: cls, retail_rank: retail, partner_rank: partner }) as CountyRow["acquisition"];

const queue = (raw: number, adj: number, projects: number, rankChange = 0) =>
  ({ raw_mw: raw, adj_mw: adj, projects, ratio: adj / raw, rank_change: rankChange }) as CountyRow["queue"];

const dc = (sites: number, naicsOnly = 0, outside = 0) => ({ sites, sites_naics_only: naicsOnly, sites_outside_ercot: outside });

test("the acquisition summary counts scored counties, each channel list and the top class", () => {
  const rows = [
    row("1", { acquisition: acq(1, 5, 1, null) }),
    row("2", { acquisition: acq(2, 5, null, 1) }),
    row("3", { acquisition: acq(3, 2, 2, 2) }),
    row("4"),
    row("5", { in_ercot: false, acquisition: acq(9, 5, 3, null) }),
  ];
  assert.deepEqual(acquisitionSummary(rows), { scored: 3, retail: 2, partnership: 2, topClass: 2 });
});

test("the queue summary adds every county, those flagged outside ERCOT too, and gives adjusted over raw", () => {
  const rows = [row("1", { queue: queue(300, 30, 3) }), row("2", { queue: queue(100, 10, 1) }), row("3", { in_ercot: false, queue: queue(100, 10, 1) })];
  assert.deepEqual(queueSummary(rows), { rawMw: 500, adjMw: 50, projects: 5, ratio: 0.1 });
  assert.equal(queueSummary([row("1")]).ratio, null);
});

test("the data-center summary follows the NAICS switch and counts the sites outside ERCOT apart", () => {
  const rows = [row("1", { data_centers: dc(3, 1) }), row("2", { data_centers: dc(1, 1) }), row("3", { in_ercot: false, data_centers: dc(0, 0, 2) })];
  assert.deepEqual(dataCenterSummary(rows, true), { sites: 4, counties: 2, naicsOnly: 2, outside: 2 });
  assert.deepEqual(dataCenterSummary(rows, false), { sites: 2, counties: 1, naicsOnly: 2, outside: 2 });
});

test("the table lists acquisition by rank, or by the list's own rank on a channel list", () => {
  const rows = [row("a", { acquisition: acq(2, 4, 1, null) }), row("b", { acquisition: acq(1, 5, null, 1) }), row("c", { acquisition: acq(3, 3, 2, 2) })];
  const ids = (list: "all" | "retail" | "partnership") =>
    rankedCounties(rows, { layer: "acquisition", list, metric: "adjusted", naics: true }).map((r) => r.county_fips);
  assert.deepEqual(ids("all"), ["b", "a", "c"]);
  assert.deepEqual(ids("retail"), ["a", "c"]);
  assert.deepEqual(ids("partnership"), ["b", "c"]);
});

test("the table lists the queue by the chosen metric from the top, and data centers by count, leaving out empty counties", () => {
  const rows = [row("a", { queue: queue(100, 50, 1, -2) }), row("b", { queue: queue(300, 30, 2, 5), data_centers: dc(2) }), row("c", { data_centers: dc(1, 1) })];
  const q = (metric: "raw" | "adjusted" | "rank_change") =>
    rankedCounties(rows, { layer: "queue", list: "all", metric, naics: true }).map((r) => r.county_fips);
  assert.deepEqual(q("raw"), ["b", "a"]);
  assert.deepEqual(q("adjusted"), ["a", "b"]);
  assert.deepEqual(q("rank_change"), ["b", "a"]);
  const d = (naics: boolean) => rankedCounties(rows, { layer: "data-centers", list: "all", metric: "raw", naics }).map((r) => r.county_fips);
  assert.deepEqual(d(true), ["b", "c"]);
  assert.deepEqual(d(false), ["b"]);
  assert.deepEqual(rankedCounties(rows, { layer: "zones", list: "all", metric: "raw", naics: true }), []);
});
