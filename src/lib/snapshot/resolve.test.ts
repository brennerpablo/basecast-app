import assert from "node:assert/strict";
import { test } from "node:test";

import { MODEL_RUN_FILTERS } from "@/lib/model-runs";

import { files } from "./paths";
import { fileReader } from "./reader";
import { type Answer, csvRecords, resolve } from "./resolve";

// The committed snapshot itself: the filters are checked against what the live API answered.
const read = fileReader();

type Params = Record<string, string | number | boolean | string[]>;

function search(params: Params = {}): URLSearchParams {
  const out = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((v) => out.append(name, v));
    else out.set(name, String(value));
  }
  return out;
}

const get = (path: string, params?: Params) => resolve(path, search(params), read);
const data = <T>(answer: Answer) => (answer.body as { data: T }).data;

type Parity = {
  accounts: { params: Params; ids: string[]; total: number }[];
  csv: { params: Params; text: string }[];
  events: { id: string; params: Params; data: unknown }[];
};
const parity = read.json<Parity>(files.parity)!;

test("the accounts filters and sorts answer what get-data answered", () => {
  assert.ok(parity.accounts.length > 10);
  for (const { params, ids, total } of parity.accounts) {
    const answer = get("accounts", params);
    assert.equal(answer.status, 200);
    const got = data<{ items: { account_id: string }[]; total: number }>(answer);
    assert.deepEqual(got.items.map((a) => a.account_id), ids, JSON.stringify(params));
    assert.equal(got.total, total, JSON.stringify(params));
  }
});

test("the CSV export keeps get-data's text, filtered and in the list's order", () => {
  for (const { params, text } of parity.csv) {
    const answer = get("accounts/export.csv", params);
    assert.equal(answer.body, text, JSON.stringify(params));
    assert.match(answer.headers?.["content-disposition"] ?? "", /attachment; filename="basecast-accounts-.+\.csv"/);
  }
});

test("an account's events filter and page as get-data did", () => {
  for (const { id, params, data: expected } of parity.events) {
    assert.deepEqual(data(get(`accounts/${id}/events`, params)), expected, `${id} ${JSON.stringify(params)}`);
  }
});

test("a left-out parameter answers the API's default", () => {
  const { defaults } = read.manifest();
  const peak = data<{ variant: string; region: string }>(get("forecasts/peak"));
  assert.equal(peak.variant, defaults.peakVariant);
  assert.equal(peak.region, "ERCOT");
  assert.equal(data<{ as_of: string }>(get("backtest/peak")).as_of, defaults.backtestAsOf);
  const counties = data<{ horizon: number; stratum: string }>(get("geo/counties", { stratum: "solar" }));
  assert.deepEqual([counties.horizon, counties.stratum], [defaults.countiesHorizon, "solar"]);
});

test("unknown ids and dates fail as the API does", () => {
  assert.deepEqual(get("accounts/nope"), { status: 404, body: { detail: "not_found" } });
  assert.equal(get("accounts/nope/events").status, 404);
  assert.equal(get("geo/counties/99999").status, 404);
  const asOf = get("backtest/peak", { as_of: "2020-01-01" });
  assert.equal(asOf.status, 422);
  assert.equal((asOf.body as { detail: string }).detail, "invalid_as_of");
  assert.ok((asOf.body as { as_of_dates: string[] }).as_of_dates.length > 0);
  assert.equal(get("tables/nope").status, 404);
  assert.equal(get("lake/object/content", { key: "raw/x" }).status, 404);
  assert.equal(get("health").status, 404);
});

test("the model runs read from etl_run match the pipeline's runs", () => {
  const rows = data<{ columns: { name: string }[]; rows: unknown[][] }>(
    get("tables/etl_run/rows", { filter: MODEL_RUN_FILTERS, sort: "started_at", desc: true, limit: 20 }),
  );
  const runId = rows.columns.findIndex((c) => c.name === "run_id");
  const fromRows = rows.rows.map((r) => r[runId]);
  const fromRuns = data<{ items: { run_id: string }[] }>(get("pipeline/runs", { source: "marts", stage: "model", limit: 20 }));
  assert.ok(fromRows.length > 0);
  assert.deepEqual(fromRows, fromRuns.items.map((r) => r.run_id));

  const one = data<{ rows: unknown[][] }>(
    get("tables/etl_run/rows", { filter: [...MODEL_RUN_FILTERS, `run_id:eq:${fromRows[0]}`], limit: 1 }),
  );
  assert.equal(one.rows.length, 1);
  assert.equal(get("tables/etl_run/rows", { filter: "nope:eq:1" }).status, 422);
});

test("table rows filter, sort and count within what was kept", () => {
  const all = data<{ rows: unknown[][]; total: number }>(get("tables/etl_run/rows", { with_summary: true, limit: 1000 }));
  const failed = data<{ rows: unknown[][]; total: number }>(
    get("tables/etl_run/rows", { filter: "status:in:failed\x1fabandoned", with_summary: true }),
  );
  assert.equal(all.total, all.rows.length);
  assert.ok(failed.total < all.total);
  assert.equal(data<{ total: number | null }>(get("tables/etl_run/rows")).total, null);
});

test("the lake lists a folder, searches it and lists raw/ recursively", () => {
  const root = data<{ folders: { prefix: string }[] }>(get("lake/list", { prefix: "" }));
  assert.deepEqual(root.folders.map((f) => f.prefix), ["derived/", "parquet/", "raw/"]);
  assert.equal(get("lake/list", { prefix: "raw" }).status, 422);
  assert.equal(get("lake/list", { prefix: "nope/" }).status, 404);

  const raw = data<{ folders: { prefix: string; files: number }[] }>(get("lake/list", { prefix: "raw/" }));
  const source = raw.folders[0];
  const flat = data<{ objects: { key: string }[]; total_objects: number }>(
    get("lake/list", { prefix: source.prefix, recursive: true, limit: 1000 }),
  );
  assert.equal(flat.total_objects, source.files);
  assert.ok(flat.objects.every((o) => o.key.startsWith(source.prefix)));
  const object = get("lake/object", { key: flat.objects[0].key });
  assert.equal(object.status, 200);
});

test("CSV records keep a quoted line break inside their record", () => {
  assert.deepEqual(csvRecords('a,b\r\n1,"x\r\ny"\r\n2,z\r\n'), ["a,b\r\n", '1,"x\r\ny"\r\n', "2,z\r\n"]);
});
