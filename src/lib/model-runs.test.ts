/**
 * Model runs read from `etl_run` rows as get-data serves them (events and params as JSON text): the parse, the
 * steps by mart in build order, the tallies, the run behind a mart and the check values. The events are trimmed
 * from the real backtest build (run 151d82da, code 568eb48).
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { checkDelta, checkValue, martScreen, parseRuns, type RowsPage, runThatBuilt, stepsOf, tally } from "./model-runs";

const COLUMNS = ["run_id", "source", "stage", "started_at", "finished_at", "duration_s", "status", "rows", "error", "events", "params"];

const events = [
  { at: "2026-09-27T00:07:10Z", kind: "mart.check", mart: "mart_peak_backtest", check: "18 basecast cells", status: "passed", expected: 18, actual: 18 },
  { at: "2026-09-27T00:07:10Z", kind: "mart.check", mart: "mart_peak_backtest", check: "basecast MAPE", status: "passed", expected: 3.3, actual: 3.2992 },
  { at: "2026-09-27T00:07:11Z", kind: "mart.check", mart: "mart_peak_backtest", check: "golden for as_of", status: "skipped", reason: "golden for other build switches" },
  { at: "2026-09-27T00:07:12Z", kind: "mart.built", mart: "mart_peak_backtest", rows: 58, as_of: "2026-09-26", duration_s: 3.2, model_version: "568eb48.v1" },
  { at: "2026-09-27T00:07:02Z", kind: "mart.built", mart: "mart_actual_summer_peaks", rows: 24, as_of: "2026-09-26", duration_s: 0.4, model_version: "568eb48.v2" },
];

const page = {
  columns: COLUMNS.map((name) => ({ name, type: "text", source_type: "text" })),
  rows: [
    ["aaaa1111", "marts", "model", "2026-09-26T23:42:00Z", null, 5, "success", 24, null, "[]", '{"code":"ef9d7fd","as_of":"2026-09-26","marts":["mart_actual_summer_peaks"],"dry_run":false}'],
    [
      "151d82da",
      "marts",
      "model",
      "2026-09-27T00:07:00Z",
      "2026-09-27T00:08:00Z",
      60,
      "success",
      82,
      null,
      JSON.stringify(events),
      JSON.stringify({ code: "568eb48", as_of: "2026-09-26", marts: ["mart_actual_summer_peaks", "mart_peak_backtest"], dry_run: false }),
    ],
  ],
  offset: 0,
  limit: 50,
  total: 2,
  total_estimated: false,
} as unknown as RowsPage;

test("runs parse from JSON text, newest first, with params and events", () => {
  const [run, older] = parseRuns(page);
  assert.equal(run.runId, "151d82da");
  assert.equal(older.runId, "aaaa1111");
  assert.equal(run.code, "568eb48");
  assert.equal(run.asOf, "2026-09-26");
  assert.deepEqual(run.marts, ["mart_actual_summer_peaks", "mart_peak_backtest"]);
  assert.equal(run.checks.length, 3);
  assert.equal(run.checks[2].reason, "golden for other build switches");
  assert.deepEqual(run.built[0], { at: "2026-09-27T00:07:12Z", mart: "mart_peak_backtest", rows: 58, asOf: "2026-09-26", durationS: 3.2, modelVersion: "568eb48.v1" });
  assert.deepEqual(tally(run.checks), { passed: 2, failed: 0, skipped: 1, total: 3 });
});

test("steps follow the build's mart order and carry their checks and output", () => {
  const [run] = parseRuns(page);
  const steps = stepsOf(run);
  assert.deepEqual(steps.map((s) => s.mart), ["mart_actual_summer_peaks", "mart_peak_backtest"]);
  assert.equal(steps[0].checks.length, 0);
  assert.equal(steps[0].built?.rows, 24);
  assert.equal(steps[1].checks.length, 3);
});

test("a mart links to the newest run that wrote it", () => {
  const runs = parseRuns(page);
  assert.equal(runThatBuilt(runs, "mart_peak_backtest")?.runId, "151d82da");
  assert.equal(runThatBuilt(runs, "mart_accounts"), null);
});

test("check values read as text and a numeric miss shows its delta", () => {
  assert.equal(checkValue(92818.6), "92,818.6");
  assert.equal(checkValue(false), "false");
  assert.equal(checkValue(undefined), "");
  assert.ok(Math.abs((checkDelta({ at: "", mart: "", check: "", status: "passed", expected: 3.3, actual: 3.2992 }) ?? 0) + 0.0008) < 1e-9);
  assert.equal(checkDelta({ at: "", mart: "", check: "", status: "passed", expected: 18, actual: 18 }), null);
});

test("each mart links to the screen that reads it", () => {
  assert.equal(martScreen("mart_peak_backtest")?.href, "/backtest");
  assert.equal(martScreen("mart_four_cp_rates")?.href, "/forecast?tab=4cp");
  assert.equal(martScreen("mart_peak_forecast")?.href, "/forecast");
  assert.equal(martScreen("mart_account_detail")?.href, "/accounts");
  assert.equal(martScreen("mart_county_acquisition")?.href, "/explorer");
  assert.equal(martScreen("mart_nothing"), null);
});
