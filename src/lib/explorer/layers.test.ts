import assert from "node:assert/strict";
import { test } from "node:test";

import { CHANNEL_HUE, channelColor, mix, NO_DATA, OUTSIDE, SURFACE } from "./colors";
import { classOf, type CountyRow, dataCenterCount, paintLayer, quantileBreaks, queueValue } from "./layers";

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

const acquisition = (channel: "retail_direct" | "partnership" | "mixed", cls: number, retail: number | null, partner: number | null) =>
  ({
    priority: 0.5,
    rank: 1,
    priority_class: cls,
    market_score: 0.8,
    grid_score: 0.7,
    grid_factor: 0.9,
    channel,
    partner_type: null,
    retail_share: 0.5,
    coop_share: 0.3,
    muni_share: 0.1,
    outside_share: 0.1,
    partner_share: 0.4,
    addressable_share: 0.9,
    retail_rank: retail,
    partner_rank: partner,
    n_partners: 1,
    top_partner_share: null,
    drivers: [],
    drags: [],
  }) as CountyRow["acquisition"];

test("mix walks sRGB between two colors", () => {
  assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
  assert.equal(mix("#2a78d6", "#2a78d6", 0.3), "#2a78d6");
});

test("a channel's top class is its full hue, lower classes move toward the surface", () => {
  assert.equal(channelColor("partnership", 5, "light"), CHANNEL_HUE.partnership.light);
  assert.notEqual(channelColor("partnership", 1, "light"), channelColor("partnership", 5, "light"));
  assert.equal(channelColor("mixed", 9, "dark"), CHANNEL_HUE.mixed.dark);
  assert.equal(channelColor("retail_direct", 1, "light"), mix(SURFACE.light, CHANNEL_HUE.retail_direct.light, 0.22));
});

test("acquisition: hue by channel, faded outside the chosen list, outside ERCOT apart", () => {
  const rows = [
    row("48001", { acquisition: acquisition("retail_direct", 5, 3, null) }),
    row("48003", { acquisition: acquisition("partnership", 2, null, 7) }),
    row("35001", { in_ercot: false }),
  ];
  const all = paintLayer(rows, { layer: "acquisition", list: "all", metric: "raw", naics: true }, "light");
  assert.equal(all.styles.get("48001")?.color, CHANNEL_HUE.retail_direct.light);
  assert.equal(all.styles.get("48001")?.dim, false);
  assert.equal(all.styles.get("35001")?.color, OUTSIDE.light);
  const retail = paintLayer(rows, { layer: "acquisition", list: "retail", metric: "raw", naics: true }, "light");
  assert.equal(retail.styles.get("48001")?.dim, false);
  assert.equal(retail.styles.get("48003")?.dim, true);
});

test("queue: a county with no project is no-data, not zero", () => {
  const q = (raw: number, adj: number, change: number) => ({
    projects: 1,
    projects_ia: 0,
    raw_mw: raw,
    raw_mw_ia: 0,
    adj_mw: adj,
    ratio: adj / raw,
    rank_raw: 1,
    rank_adj: 1,
    rank_change: change,
    large_gas_mw_2028: null,
  });
  const rows = [row("48001", { queue: q(1000, 100, 3) }), row("48003", { queue: q(50, 25, -2) }), row("48005")];
  assert.equal(queueValue(rows[2], "raw"), null);
  const paint = paintLayer(rows, { layer: "queue", list: "all", metric: "adjusted", naics: true }, "light");
  assert.equal(paint.styles.get("48005")?.color, NO_DATA.light);
  assert.notEqual(paint.styles.get("48001")?.color, paint.styles.get("48003")?.color);
  const change = paintLayer(rows, { layer: "queue", list: "all", metric: "rank_change", naics: true }, "light");
  assert.equal(change.legend.at(-1)?.label, "No active project");
});

test("data centers: NAICS-only matches count only when asked", () => {
  const r = row("48001", { data_centers: { sites: 5, sites_naics_only: 2, sites_outside_ercot: 0 } });
  assert.equal(dataCenterCount(r, true), 5);
  assert.equal(dataCenterCount(r, false), 3);
});

test("quantile breaks and classes", () => {
  assert.deepEqual(quantileBreaks([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), [3, 5, 7, 9]);
  assert.deepEqual(quantileBreaks([], 5), []);
  assert.equal(classOf(0, [3, 5]), 0);
  assert.equal(classOf(3, [3, 5]), 1);
  assert.equal(classOf(9, [3, 5]), 2);
});
