import assert from "node:assert/strict";
import { test } from "node:test";

import { isForwarded, passHeaders } from "./routes";

test("forwards only the allowlisted get-data paths", () => {
  for (const path of [
    "lake/sources",
    "lake/list",
    "lake/object",
    "lake/object/rows",
    "lake/object/content",
    "tables",
    "tables/open_meteo_hourly",
    "tables/open_meteo_hourly/rows",
    "tables/gis_snapshots/lineage",
    "pipeline/runs",
    "caveats",
    "accounts",
    "accounts/export.csv",
    "accounts/FX001",
    "accounts/30015/events",
    "geo/counties",
    "geo/counties/48453",
    "geo/zones",
    "queue/projects",
    "forecasts/peak",
    "forecasts/large-load",
    "load/normalized",
    "four-cp",
    "backtest/peak",
    "backtest/official-errors",
    "insights",
  ]) {
    assert.equal(isForwarded(path), true, path);
  }
  for (const path of [
    "",
    "health",
    "docs",
    "openapi.json",
    "lake/object/../../docs",
    "tables/bad-name/rows",
    "tables/a/b/c",
    "lake/sources/extra",
    "accounts/export.json",
    "accounts/../health",
    "accounts/FX001/events/1",
    "geo/counties/4845",
    "geo/counties/48453/extra",
    "forecasts/county",
    "backtest",
  ]) {
    assert.equal(isForwarded(path), false, path);
  }
});

test("a gzipped response loses its content-length, a plain one keeps it", () => {
  const gz = passHeaders(
    new Headers({ "content-encoding": "gzip", "content-length": "120", "content-type": "application/json" }),
    new Headers(),
  );
  assert.equal(gz.get("content-length"), null);
  assert.equal(gz.get("content-type"), "application/json");
  const plain = passHeaders(
    new Headers({ "content-encoding": "identity", "content-length": "4", "content-range": "bytes 0-3/9" }),
    new Headers(),
  );
  assert.equal(plain.get("content-length"), "4");
  assert.equal(plain.get("content-range"), "bytes 0-3/9");
});
