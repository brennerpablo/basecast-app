import assert from "node:assert/strict";
import { test } from "node:test";

import { HEALTH_GRACE_MS, nextCronRun, stageHealth, worstHealth } from "./health";

const iso = (d: Date | null) => d?.toISOString() ?? null;

test("nextCronRun reads the schedule in Chicago time", () => {
  // Daily 06:15 CT; 04:44 UTC on Sep 26 is 23:44 CDT on Sep 25.
  assert.equal(iso(nextCronRun("15 6 * * *", new Date("2026-09-26T04:44:04Z"))), "2026-09-26T11:15:00.000Z");
  // The same wall time in winter is an hour later in UTC (CST).
  assert.equal(iso(nextCronRun("15 6 * * *", new Date("2026-01-10T20:00:00Z"))), "2026-01-11T12:15:00.000Z");
});

test("nextCronRun handles weekdays, days of month and month lists", () => {
  // Mondays 07:00; Sep 26, 2026 is a Saturday.
  assert.equal(iso(nextCronRun("0 7 * * 1", new Date("2026-09-26T12:00:00Z"))), "2026-09-28T12:00:00.000Z");
  // Day 3 of each month, 08:00.
  assert.equal(iso(nextCronRun("0 8 3 * *", new Date("2026-09-26T12:00:00Z"))), "2026-10-03T13:00:00.000Z");
  // Quarterly, day 15.
  assert.equal(iso(nextCronRun("0 7 15 1,4,7,10 *", new Date("2026-09-26T12:00:00Z"))), "2026-10-15T12:00:00.000Z");
  // Sunday as 7, and steps.
  assert.equal(iso(nextCronRun("0 7 * * 7", new Date("2026-09-26T12:00:00Z"))), "2026-09-27T12:00:00.000Z");
  assert.equal(iso(nextCronRun("*/30 * * * *", new Date("2026-09-26T12:10:00Z"))), "2026-09-26T12:30:00.000Z");
});

test("nextCronRun is strictly after the given time", () => {
  assert.equal(iso(nextCronRun("0 7 * * *", new Date("2026-09-26T12:00:00Z"))), "2026-09-27T12:00:00.000Z");
});

test("nextCronRun rejects what it cannot read", () => {
  assert.equal(nextCronRun("0 7 * *", new Date()), null);
  assert.equal(nextCronRun("61 7 * * *", new Date()), null);
  assert.equal(nextCronRun("0 7 31 2 *", new Date("2026-09-26T12:00:00Z")), null);
});

test("stageHealth: fresh, stale and manual", () => {
  const updated = "2026-09-26T04:44:04Z";
  const due = Date.parse("2026-09-26T11:15:00Z");
  const fresh = stageHealth({ cron: "15 6 * * *", latest: null, lastSuccessAt: updated, now: new Date(due + HEALTH_GRACE_MS) });
  assert.equal(fresh.status, "healthy");
  assert.equal(fresh.updatedAt, updated);
  assert.equal(fresh.dueAt, "2026-09-26T11:15:00.000Z");

  const late = stageHealth({ cron: "15 6 * * *", latest: null, lastSuccessAt: updated, now: new Date(due + HEALTH_GRACE_MS + 1) });
  assert.equal(late.status, "stale");
  assert.equal(late.reason, "Overdue.");

  const manual = stageHealth({ cron: null, latest: null, lastSuccessAt: updated, now: new Date("2030-01-01") });
  assert.equal(manual.status, "healthy");
  assert.equal(manual.dueAt, null);
  assert.equal(manual.reason, "Manual.");
});

test("stageHealth: the latest run decides before the schedule", () => {
  const now = new Date("2026-09-26T16:30:00Z");
  const run = (status: string) => ({ status, started_at: "2026-09-26T16:18:00Z" });
  const base = { cron: "0 8 * * 1", lastSuccessAt: "2026-09-26T12:00:00Z", now };
  assert.equal(stageHealth({ ...base, latest: run("running") }).status, "running");
  assert.equal(stageHealth({ ...base, latest: run("failed") }).status, "failed");
  assert.equal(stageHealth({ ...base, latest: run("abandoned") }).status, "degraded");
  assert.equal(stageHealth({ ...base, latest: run("partial") }).status, "degraded");
  // The reason keeps the status and leaves the run's start time to its own field.
  assert.equal(stageHealth({ ...base, latest: run("running") }).reason, "Running.");
  assert.equal(stageHealth({ ...base, latest: run("failed") }).reason, "Latest run failed.");
  assert.equal(stageHealth({ ...base, latest: run("partial") }).reason, "Latest run partial.");
  // A failure keeps the time of the last good update.
  assert.equal(stageHealth({ ...base, latest: run("failed") }).updatedAt, "2026-09-26T12:00:00Z");
  assert.equal(stageHealth({ cron: "0 8 * * 1", latest: null, lastSuccessAt: null, now }).status, "never");
});

test("worstHealth keeps the worst status and the latest update", () => {
  const v = (status: "healthy" | "stale" | "failed", updatedAt: string) => ({ status, reason: status, updatedAt, dueAt: null });
  const worst = worstHealth([v("healthy", "2026-09-26T10:00:00Z"), v("stale", "2026-09-20T10:00:00Z"), v("healthy", "2026-09-26T12:00:00Z")]);
  assert.equal(worst.status, "stale");
  assert.equal(worst.updatedAt, "2026-09-26T12:00:00Z");
  assert.equal(worstHealth([v("stale", "2026-09-20T10:00:00Z"), v("failed", "2026-09-21T10:00:00Z")]).status, "failed");
  assert.equal(worstHealth([]).status, "never");
});
