import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { buildRow, log, type LogRow, scrub } from "./logger";
import { runWithRequestLog } from "./request-log";
import { normalizeRoute } from "./route-name";

// What the logger prints, parsed back: stdout is the log.
let written: (Omit<LogRow, "ts"> & { ts: string })[] = [];
const originalLog = console.log;
const originalError = console.error;

beforeEach(() => {
  written = [];
  console.log = console.error = (line: string) => void written.push(JSON.parse(line));
  process.env.LOG_LEVEL = "info";
});

afterEach(() => {
  console.log = originalLog;
  console.error = originalError;
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

test("LOG_LEVEL sets the lowest level printed", () => {
  log.debug("cache.hit", "hit");
  log.info("snapshot.read", "Read");
  log.warn("snapshot.missing", "Missing");
  assert.deepEqual(
    written.map((r) => r.event),
    ["snapshot.read", "snapshot.missing"],
  );
});

test("a request gets one http.request line with route template, status and duration", async () => {
  const res = await runWithRequestLog(new Request("https://x.test/api/data/accounts/30123/events?limit=10"), async () => {
    log.info("snapshot.read", "Read");
    return new Response("ok", { status: 200 });
  });
  const line = written.find((r) => r.event === "http.request");
  assert.ok(line);
  assert.equal(line.route, "/api/data/accounts/:num/events");
  assert.equal(line.method, "GET");
  assert.equal(line.status, 200);
  assert.equal(line.level, "info");
  assert.ok(typeof line.durationMs === "number");
  // Lines inside the request share its id, and the response echoes it.
  const inner = written.find((r) => r.event === "snapshot.read");
  assert.equal(inner?.requestId, line.requestId);
  assert.equal(res.headers.get("x-request-id"), line.requestId);
});

test("status sets the level: 5xx error, 4xx warn", async () => {
  await runWithRequestLog(new Request("https://x.test/api/a"), async () => new Response(null, { status: 503 }));
  await runWithRequestLog(new Request("https://x.test/api/b"), async () => new Response(null, { status: 401 }));
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
  assert.equal(written[0].status, 500);
  assert.equal(written[0].errorClass, "RangeError");
  assert.equal(written[0].fingerprint, "app:RangeError:/api/boom");
});

test("a nested wrapper does not log the request twice", async () => {
  await runWithRequestLog(new Request("https://x.test/api/outer"), () =>
    runWithRequestLog(new Request("https://x.test/api/outer"), async () => new Response("ok")),
  );
  assert.equal(written.filter((r) => r.event === "http.request").length, 1);
});
