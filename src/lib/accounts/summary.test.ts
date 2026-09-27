import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fact } from "@/lib/bff/envelope";

import { countByAction, groupTerritoryFacts, headerText, splitHeaderFacts } from "./summary";

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
