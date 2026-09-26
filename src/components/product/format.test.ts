import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDate, formatPercent, formatPower, formatValue, GAP } from "./format";

test("power is MW below 10 GW and GW with one decimal from there", () => {
  assert.equal(formatPower(8_850), "8,850 MW");
  assert.equal(formatPower(9_999.4), "9,999 MW");
  assert.equal(formatPower(9_999.6), "10.0 GW");
  assert.equal(formatPower(91_134), "91.1 GW");
  assert.equal(formatPower(-21_000), "-21.0 GW");
  assert.equal(formatPower(-0.2), "0 MW");
  assert.equal(formatPower(0), "0 MW");
});

test("a missing number is a gap, never a zero", () => {
  assert.equal(formatPower(null), GAP);
  assert.equal(formatPower(undefined), GAP);
  assert.equal(formatPower(Number.NaN), GAP);
  assert.equal(formatPercent(null), GAP);
  assert.equal(formatValue(null, "MW"), GAP);
});

test("percents carry one decimal, from a percent or a ratio, signed on request", () => {
  assert.equal(formatPercent(3.8), "3.8%");
  assert.equal(formatPercent(0.28, { ratio: true }), "28.0%");
  assert.equal(formatPercent(9.3, { signed: true }), "+9.3%");
  assert.equal(formatPercent(-13.2, { signed: true }), "-13.2%");
});

test("a calendar date never moves a day with the time zone; a timestamp reads in Chicago", () => {
  assert.equal(formatDate("2026-07-22"), "Jul 22, 2026");
  assert.equal(formatDate("2026-08"), "Aug 2026");
  // 03:00 UTC is still the evening before in Chicago.
  assert.equal(formatDate("2026-09-26T03:00:00Z"), "Sep 25, 2026");
  assert.equal(formatDate(null), GAP);
});

test("a Fact's value follows its unit", () => {
  assert.equal(formatValue(91.134, "GW"), "91.1 GW");
  assert.equal(formatValue(8_850, "MW"), "8,850 MW");
  assert.equal(formatValue(22.9, "%"), "22.9%");
  assert.equal(formatValue(1_234.567, "km²"), "1,234.57 km²");
  assert.equal(formatValue("LCRA", null), "LCRA");
  assert.equal(formatValue(true), "Yes");
});
