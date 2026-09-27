import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { buildRow, log, scrub } from "./logger";
import { runWithRequestLog } from "./request-log";
import { normalizeRoute } from "./route-name";
import { flushOpsLog, opsLogEnabled, type OpsLogRow, setOpsLogWriter } from "./sink";

let written: OpsLogRow[] = [];

beforeEach(() => {
  written = [];
  setOpsLogWriter(async (rows) => {
    written.push(...rows);
  });
  // Keep stdout quiet; the rows are what the tests read.
  process.env.LOG_LEVEL = "error";
});

afterEach(async () => {
  await flushOpsLog();
  setOpsLogWriter(null);
  delete process.env.LOG_LEVEL;
});

test("normalizeRoute turns ids into placeholders and drops the query string", () => {
  assert.equal(normalizeRoute("/api/users/cm1abc2def3ghi4jkl5mno6pq/avatar?v=3"), "/api/users/:id/avatar");
  assert.equal(normalizeRoute("https://x.test/api/counties/48453/metrics"), "/api/counties/:num/metrics");
  assert.equal(normalizeRoute("/api/runs/2026-09-26/"), "/api/runs/:date");
  assert.equal(normalizeRoute("/api/runs/0f8fad5b-d9cb-469f-a165-70867728950e"), "/api/runs/:uuid");
  assert.equal(normalizeRoute(""), "/");
});

test("scrub redacts secrets by key name, at any depth", () => {
  assert.deepEqual(scrub({ a: 1, password: "x", nested: { Authorization: "Bearer y", email: "a@b.c" } }), {
    a: 1,
    password: "[redacted]",
    nested: { Authorization: "[redacted]", email: "[redacted]" },
  });
});

test("an error fills error_class, error_stack and a fingerprint from the route", () => {
  const row = buildRow("error", "server.error", "Unhandled render error", {
    route: "/explorer",
    error: new TypeError("x is undefined"),
  });
  assert.equal(row.errorClass, "TypeError");
  assert.match(row.errorStack ?? "", /TypeError: x is undefined/);
  assert.equal(row.fingerprint, "app:TypeError:/explorer");
  assert.deepEqual(row.context, { error_message: "x is undefined" });
  assert.equal(row.service, "app");
});

test("debug stays out of ops.log; info and up are stored", async () => {
  log.debug("cache.hit", "hit");
  log.info("auth.sign_in", "Signed in", { userId: "u1" });
  log.warn("auth.sign_in_failed", "Sign-in rejected");
  await flushOpsLog();
  assert.deepEqual(
    written.map((r) => r.event),
    ["auth.sign_in", "auth.sign_in_failed"],
  );
});

test("a request gets one http.request line with route template, status and duration", async () => {
  const res = await runWithRequestLog(new Request("https://x.test/api/users/cm1abc2def3ghi4jkl5mno6pq/avatar?v=1"), async () => {
    log.info("avatar.served", "Served");
    return new Response("ok", { status: 200 });
  });
  await flushOpsLog();
  const line = written.find((r) => r.event === "http.request");
  assert.ok(line);
  assert.equal(line.route, "/api/users/:id/avatar");
  assert.equal(line.method, "GET");
  assert.equal(line.status, 200);
  assert.equal(line.level, "info");
  assert.ok(typeof line.durationMs === "number");
  // Lines inside the request share its id, and the response echoes it.
  const inner = written.find((r) => r.event === "avatar.served");
  assert.equal(inner?.requestId, line.requestId);
  assert.equal(res.headers.get("x-request-id"), line.requestId);
});

test("status sets the level: 5xx error, 4xx warn", async () => {
  await runWithRequestLog(new Request("https://x.test/api/a"), async () => new Response(null, { status: 503 }));
  await runWithRequestLog(new Request("https://x.test/api/b"), async () => new Response(null, { status: 401 }));
  await flushOpsLog();
  assert.deepEqual(
    written.map((r) => [r.route, r.level]),
    [["/api/a", "error"], ["/api/b", "warn"]],
  );
});

test("a throw is logged as a 500 with the error, then re-thrown", async () => {
  await assert.rejects(
    runWithRequestLog(new Request("https://x.test/api/boom", { method: "POST" }), async () => {
      throw new RangeError("bad range");
    }),
    RangeError,
  );
  await flushOpsLog();
  assert.equal(written[0].status, 500);
  assert.equal(written[0].errorClass, "RangeError");
  assert.equal(written[0].fingerprint, "app:RangeError:/api/boom");
});

test("a nested wrapper does not log the request twice", async () => {
  await runWithRequestLog(new Request("https://x.test/api/outer"), () =>
    runWithRequestLog(new Request("https://x.test/api/outer"), async () => new Response("ok")),
  );
  await flushOpsLog();
  assert.equal(written.filter((r) => r.event === "http.request").length, 1);
});

test("a database failure never reaches the caller", async () => {
  setOpsLogWriter(async () => {
    throw new Error("connection refused");
  });
  const originalError = console.error;
  console.error = () => {};
  try {
    log.info("x.y", "z");
    await assert.doesNotReject(flushOpsLog());
  } finally {
    console.error = originalError;
  }
});

test("healthy /api/ops polls are not stored; their failures are", async () => {
  await runWithRequestLog(new Request("https://x.test/api/ops/overview?range=24h"), async () => new Response("{}"));
  await runWithRequestLog(new Request("https://x.test/api/ops/logs"), async () => new Response(null, { status: 500 }));
  await flushOpsLog();
  assert.deepEqual(
    written.map((r) => [r.route, r.status, r.fingerprint]),
    [["/api/ops/logs", 500, "app:HTTP 500:/api/ops/logs"]],
  );
});

test("ops.log is written from a deploy or on request, never from a local server by default", () => {
  assert.equal(opsLogEnabled({}), false);
  assert.equal(opsLogEnabled({ NODE_ENV: "production" }), false);
  assert.equal(opsLogEnabled({ VERCEL_ENV: "production" }), true);
  assert.equal(opsLogEnabled({ VERCEL_ENV: "preview" }), true);
  assert.equal(opsLogEnabled({ VERCEL: "1" }), true);
  assert.equal(opsLogEnabled({ OPS_LOG: "1" }), true);
  assert.equal(opsLogEnabled({ VERCEL_ENV: "production", OPS_LOG: "0" }), false);
});
