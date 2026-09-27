import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fact } from "@/lib/bff/envelope";

import { countByAction, gapText, groupTerritoryFacts, headerText, methodText, pitchPoints, splitHeaderFacts, splitLabel } from "./summary";

const fact = (key: string, value: Fact["value"] = 1): Fact => ({ key, label: key, value }) as Fact;

test("every next action is counted, with a zero when no account carries it", () => {
  const counts = countByAction([{ next_action: "call_now" }, { next_action: "watch" }, { next_action: "call_now" }]);
  assert.deepEqual(counts, { call_now: 2, nurture: 0, watch: 1, hold: 0 });
});

test("header facts split into the KPI strip and the profile, in the API's order, dropping only the title's", () => {
  const facts = [
    fact("name", "New Braunfels Utilities"),
    fact("account_type", "muni"),
    fact("ccn_no", "30123"),
    fact("territory_km2"),
    fact("customers"),
    fact("gt", "LCRA"),
    fact("price"),
    fact("something_new"),
  ];
  const { kpis, profile } = splitHeaderFacts(facts);
  assert.deepEqual(kpis.map((f) => f.key), ["territory_km2", "customers", "price"]);
  assert.deepEqual(profile.map((f) => f.key), ["ccn_no", "gt", "something_new"]);
});

test("a header fact's text is its string value, and null when missing or blank", () => {
  const facts = [fact("gt", "LCRA"), fact("counties", " "), fact("customers", 60_463)];
  assert.equal(headerText(facts, "gt"), "LCRA");
  assert.equal(headerText(facts, "counties"), null);
  assert.equal(headerText(facts, "customers"), null);
  assert.equal(headerText(facts, "absent"), null);
});

test("territory facts group by theme in the API's order, and an unknown key lands in other", () => {
  const keys = ["population", "dc_sites_expected", "queue_raw_mw", "storage_adj_2028", "weather_zone", "zone_4cp_mw", "pop_growth", "account_4cp_mw"];
  const groups = groupTerritoryFacts(keys.map((key) => fact(key)));
  assert.deepEqual(groups.growth.map((f) => f.key), ["population", "pop_growth"]);
  assert.deepEqual(groups.dataCenters.map((f) => f.key), ["dc_sites_expected"]);
  assert.deepEqual(groups.queue.map((f) => f.key), ["queue_raw_mw", "storage_adj_2028"]);
  assert.deepEqual(groups.zone.map((f) => f.key), ["weather_zone", "zone_4cp_mw"]);
  assert.deepEqual(groups.other.map((f) => f.key), ["account_4cp_mw"]);
});

test("the pitch drops the zone's 4CP line, with or without the outlook's trailing clause, and keeps the rest", () => {
  const zone = "4CP (NCENT, 2025): zone load at the CPs 92% of its own peak";
  const points = ["bill pressure: 4CP savings", `${zone}; no $/kW-yr rate in the repo (not verified)`];
  assert.deepEqual(pitchPoints(points, zone), ["bill pressure: 4CP savings"]);
  assert.deepEqual(pitchPoints([...points.slice(0, 1), "other line"], zone, "other line"), ["bill pressure: 4CP savings"]);
  assert.deepEqual(pitchPoints(points, null), points);
});

test("a gap's text loses a trailing internal source, and keeps other parentheticals", () => {
  assert.equal(gapText("Account load at the 4CP: no value (UtilityDataSource)"), "Account load at the 4CP: no value");
  assert.equal(gapText("Generation queue, raw (context counties): no value (queue_adjusted)"), "Generation queue, raw (context counties): no value");
  assert.equal(gapText("customers +12% in 2024 vs 2023"), "customers +12% in 2024 vs 2023");
  assert.equal(gapText("Price: no value (EIA-861)"), "Price: no value (EIA-861)");
});

test("the score method drops the config file it cites", () => {
  assert.equal(
    methodText("weighted mean of within-universe percentile ranks (config/account_score.yaml, pending review)"),
    "Weighted mean of within-universe percentile ranks",
  );
  assert.equal(methodText("weighted mean (fixture weights)"), "Weighted mean (fixture weights)");
});

test("a label splits at its first parenthetical", () => {
  assert.deepEqual(splitLabel("3 exposed counties (share ≥ 20%)"), {
    short: "3 exposed counties",
    detail: "3 exposed counties (share ≥ 20%)",
  });
  assert.deepEqual(splitLabel("home county: Fayette"), { short: "Home county: Fayette", detail: null });
});
