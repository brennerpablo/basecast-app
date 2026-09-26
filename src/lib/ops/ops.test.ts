import assert from "node:assert/strict";
import { test } from "node:test";

import { pipelineHealth, requestHealth } from "./health";
import { bucketStarts, parseRange } from "./range";

test("request health: idle without traffic, degraded on 5xx or slow p95", () => {
  assert.equal(requestHealth({ requests: 0, errors5xx: 0, p95Ms: null }).status, "idle");
  assert.equal(requestHealth({ requests: 100, errors5xx: 3, p95Ms: 200 }).status, "degraded");
  assert.equal(requestHealth({ requests: 100, errors5xx: 2, p95Ms: 200 }).status, "healthy");
  assert.equal(requestHealth({ requests: 100, errors5xx: 0, p95Ms: 1_600 }).status, "degraded");
});

test("pipeline health: failing sources first, then staleness", () => {
  const now = new Date("2026-09-26T19:00:00Z");
  const recent = new Date("2026-09-26T18:00:00Z");
  const failing = pipelineHealth([{ source: "ercot_gis" }, { source: "ercot_gis" }], recent, now);
  assert.equal(failing.status, "degraded");
  assert.equal(failing.reason, "Latest run failed: ercot_gis");
  assert.equal(pipelineHealth([], recent, now).status, "healthy");
  assert.equal(pipelineHealth([], new Date("2026-09-25T10:00:00Z"), now).status, "stalled");
  assert.equal(pipelineHealth([], null, now).status, "idle");
});

test("parseRange falls back to 24h", () => {
  assert.equal(parseRange("7d"), "7d");
  assert.equal(parseRange("2y"), "24h");
  assert.equal(parseRange(null), "24h");
});

test("bucketStarts covers the range on Chicago-aligned boundaries", () => {
  const starts = bucketStarts(new Date("2026-09-25T19:30:00Z"), new Date("2026-09-26T19:30:00Z"), 3_600_000);
  assert.equal(starts[0], "2026-09-25T19:00:00.000Z");
  assert.equal(starts.at(-1), "2026-09-26T19:00:00.000Z");
  assert.equal(starts.length, 25);
  const days = bucketStarts(new Date("2026-09-20T12:00:00Z"), new Date("2026-09-26T12:00:00Z"), 86_400_000);
  assert.equal(days[0], "2026-09-20T06:00:00.000Z");
});
