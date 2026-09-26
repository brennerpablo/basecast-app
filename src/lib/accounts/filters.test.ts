import assert from "node:assert/strict";
import { test } from "node:test";

import { dataUrl } from "@/lib/bff/url";

import { accountsApiParams, type AccountsFilters, hasActiveFilters } from "./filters";

const NONE: AccountsFilters = {
  type: [],
  tier: [],
  action: [],
  trigger: [],
  zone: [],
  gt: [],
  q: "",
  county: null,
  rank: "all",
};

test("no filter asks for the unfiltered list", () => {
  assert.deepEqual(accountsApiParams(NONE), {});
  assert.equal(hasActiveFilters(NONE), false);
  // The rank toggle reorders, it does not filter.
  assert.equal(hasActiveFilters({ ...NONE, rank: "within_type" }), false);
});

test("filters map to get-data's names, and the list and the export read the same params", () => {
  const filters: AccountsFilters = {
    ...NONE,
    tier: ["A", "B"],
    action: ["call_now"],
    gt: ["Brazos Electric Power Cooperative, Inc."],
    q: "  city ",
    county: "48453",
    rank: "within_type",
  };
  const params = accountsApiParams(filters);
  assert.deepEqual(params, {
    tier: ["A", "B"],
    next_action: ["call_now"],
    gt: ["Brazos Electric Power Cooperative, Inc."],
    q: "city",
    county: "48453",
    rank_scope: "within_type",
  });
  const list = dataUrl("accounts", params);
  const csv = dataUrl("accounts/export.csv", params);
  assert.equal(list.split("?")[1], csv.split("?")[1]);
  assert.match(list, /tier=A&tier=B/);
  assert.match(list, /gt=Brazos\+Electric\+Power\+Cooperative%2C\+Inc\./);
  assert.equal(hasActiveFilters(filters), true);
});
