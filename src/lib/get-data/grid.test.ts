import assert from "node:assert/strict";
import { test } from "node:test";

import { gridFilterParams, toGetDataParams, toGridBlock } from "./grid";

test("grid params become get-data params", () => {
  const p = gridFilterParams("point_id");
  const search = new URLSearchParams([
    ["offset", "500"],
    ["limit", "500"],
    ["withSummary", "1"],
    ["sort", "ts_utc"],
    ["dir", "desc"],
    [p.equals, "east_tyler"],
    [gridFilterParams("ts_utc").range.min, "2018-01-01"],
    [gridFilterParams("weather_zone").csv, "EAST\u001fCOAST"],
    ["f.bad", "x"],
    ["sheet", "Summary"],
  ]);
  const out = toGetDataParams(search);
  assert.deepEqual([...out], [
    ["offset", "500"],
    ["limit", "500"],
    ["with_summary", "true"],
    ["sort", "ts_utc"],
    ["desc", "true"],
    ["filter", "point_id:eq:east_tyler"],
    ["filter", "ts_utc:gte:2018-01-01"],
    ["filter", "weather_zone:in:EAST\u001fCOAST"],
    ["sheet", "Summary"],
  ]);
});

test("ascending sort and no summary add nothing", () => {
  const out = toGetDataParams(new URLSearchParams("offset=0&limit=500&dir=asc&sort=a"));
  assert.equal(out.toString(), "offset=0&limit=500&sort=a");
});

test("rows become objects keyed by column, the total a summary", () => {
  const block = toGridBlock({
    meta: { generated_at: "2026-09-26T16:00:00Z" },
    data: {
      columns: [{ name: "A" }, { name: "B" }],
      rows: [["INR", "Project Name"], ["15INR0064b"]],
      offset: 24,
      limit: 2,
      total: 1807,
      total_estimated: false,
    },
  });
  assert.deepEqual(block.rows, [
    { A: "INR", B: "Project Name" },
    { A: "15INR0064b", B: null },
  ]);
  assert.equal(block.total, 1807);
  assert.deepEqual(block.summary, { count: 1807, estimated: false });
  assert.equal(block.generatedAt, "2026-09-26T16:00:00Z");
});
