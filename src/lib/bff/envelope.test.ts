import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { BffError, fetchEnvelope, isMartNotBuilt } from "./envelope";
import { dataUrl } from "./url";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function answer(status: number, body: unknown) {
  const calls: string[] = [];
  globalThis.fetch = (async (url: string) => {
    calls.push(url);
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

const META = {
  generated_at: "2026-09-26T18:00:00Z",
  data_as_of: "2026-09-01",
  model_version: "9c62100.1",
  simulated: true,
  verified: true,
  sources: ["fixture"],
  caveats: [{ code: "fixture", label: "Fixture", text: "Development fixture." }],
};

test("the BFF URL drops empty params and repeats arrays", () => {
  assert.equal(dataUrl("accounts"), "/api/data/accounts");
  assert.equal(
    dataUrl("accounts", { tier: ["A", "B"], q: "", county: null, rank_scope: "within_type" }),
    "/api/data/accounts?tier=A&tier=B&rank_scope=within_type",
  );
});

test("a 200 returns data and meta", async () => {
  const calls = answer(200, { data: { items: [] }, meta: META });
  const envelope = await fetchEnvelope<{ items: unknown[] }>("accounts", { tier: "A" });
  assert.deepEqual(envelope.data, { items: [] });
  assert.equal(envelope.meta.caveats[0].code, "fixture");
  assert.deepEqual(calls, ["/api/data/accounts?tier=A"]);
});

test("a 503 mart_not_built names the mart", async () => {
  answer(503, { detail: "mart_not_built", mart: "mart_accounts" });
  await assert.rejects(fetchEnvelope("accounts"), (error: unknown) => {
    assert.ok(isMartNotBuilt(error));
    assert.equal(error.mart, "mart_accounts");
    assert.equal(error.status, 503);
    return true;
  });
});

test("any other failure is a plain error with get-data's detail", async () => {
  answer(503, { detail: "The data API is not configured here." });
  await assert.rejects(fetchEnvelope("accounts"), (error: unknown) => {
    assert.ok(error instanceof BffError);
    assert.equal(isMartNotBuilt(error), false);
    assert.equal(error.message, "The data API is not configured here.");
    return true;
  });
  answer(404, { detail: "not_found" });
  await assert.rejects(fetchEnvelope("accounts/FX999"), (error: unknown) => {
    assert.ok(error instanceof BffError);
    assert.equal(error.status, 404);
    return true;
  });
});

test("a 200 without meta is an error, not an empty view", async () => {
  answer(200, { data: [] });
  await assert.rejects(fetchEnvelope("accounts"), BffError);
});
