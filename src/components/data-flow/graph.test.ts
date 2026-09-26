import assert from "node:assert/strict";
import { test } from "node:test";

import type { Schemas, SourceSummary, TableSummary } from "@/components/data-browser/api";

import { buildFlow, collectSources, flowGroups, lineage, nodeIdForSteps, OUTSIDE_LAKE } from "./graph";

// Trimmed from get-data's answers on 2026-09-26.
const source = (id: string, group: string, publisher: string, cron: string | null, fetched: string): SourceSummary => ({
  source_id: id,
  name: id.replace(/_/g, " "),
  group,
  publisher,
  description: null,
  upstream_url: null,
  catalog_id: null,
  schedule: cron ? "Scheduled" : "Manual",
  schedule_cron: cron,
  files: 3,
  bytes: 1000,
  snapshots: 1,
  first_dt: "2026-09-26",
  last_dt: "2026-09-26",
  last_fetched_at: fetched,
  formats: [{ extension: "csv", files: 3 }],
  datasets: [],
  last_runs: [],
});

const table = (name: string, sources: string[], mode: string, extra: Partial<TableSummary> & { inputs?: string[] } = {}) =>
  ({
    name,
    engine: "postgres",
    location: "public",
    kind: "dataset",
    sources,
    mode,
    description: null,
    declared: true,
    loaded: true,
    rows: 10,
    rows_estimated: true,
    bytes: 100,
    ...extra,
  }) as TableSummary;

const run = (source: string, status: string, started: string): Schemas["Run"] => ({
  run_id: `${source}-${started}`,
  source,
  stage: "process",
  dag_id: null,
  task_id: null,
  started_at: started,
  finished_at: status === "running" ? null : started,
  duration_s: 1,
  status,
  rows: 10,
  files: 1,
  files_skipped: 0,
  bytes: 0,
  error: null,
});

const SOURCES = [
  source("ercot_tpit", "ERCOT", "ERCOT", "30 8 12 * *", "2026-09-26T05:32:12Z"),
  source("ercot_large_load_decks", "ERCOT", "ERCOT", "0 8 * * 1", "2026-09-26T12:57:21Z"),
  source("census_tx_counties_geo", "Census", "Census", null, "2026-09-26T04:30:58Z"),
  source("puct_ccn_territories", "PUCT", "PUCT", "0 9 3 * *", "2026-09-26T05:32:47Z"),
];
const TABLES = [
  table("tpit_projects", ["ercot_tpit"], "by_file"),
  table("tpit_project_history", ["ercot_tpit"], "sql", { inputs: ["tpit_projects"] }),
  table("large_load_status", ["ercot_large_load_decks"], "by_file", { loaded: false, rows: null }),
  table("tx_counties", ["census_tx_counties_geo"], "replace"),
  table("puct_ccn_territories", ["puct_ccn_territories"], "replace"),
  table("county_iso_share", ["puct_ccn_territories"], "sql", { inputs: ["puct_ccn_territories", "tx_counties"] }),
  table("manual_official_forecasts", ["config_facts"], "replace"),
  table("etl_run", [], "replace", { kind: "system" }),
];
const RUNS = [
  run("ercot_tpit", "success", "2026-09-26T16:00:00Z"),
  run("ercot_large_load_decks", "running", "2026-09-26T16:18:00Z"),
  run("census_tx_counties_geo", "success", "2026-09-26T14:59:00Z"),
  run("puct_ccn_territories", "failed", "2026-09-26T15:16:00Z"),
  run("puct_ccn_territories", "success", "2026-09-25T15:16:00Z"),
  run("config_facts", "success", "2026-09-26T15:52:00Z"),
];
const NOW = new Date("2026-09-26T16:30:00Z");
const FLOW_SOURCES = collectSources(SOURCES, TABLES, RUNS, NOW);

test("collectSources adds the pipelines only tables name, outside the lake", () => {
  const config = FLOW_SOURCES.find((s) => s.id === "config_facts");
  assert.ok(config);
  assert.equal(config.inLake, false);
  assert.equal(config.group, "Other");
  assert.equal(config.process.status, "healthy");
});

test("collectSources reads each stage's health from the runs", () => {
  const by = new Map(FLOW_SOURCES.map((s) => [s.id, s]));
  assert.equal(by.get("ercot_tpit")?.process.status, "healthy");
  assert.equal(by.get("ercot_large_load_decks")?.process.status, "running");
  const puct = by.get("puct_ccn_territories");
  assert.equal(puct?.process.status, "failed");
  // The failure keeps the time of the last success.
  assert.equal(puct?.process.updatedAt, "2026-09-25T15:16:00Z");
  assert.equal(by.get("ercot_tpit")?.ingest.updatedAt, "2026-09-26T05:32:12Z");
});

test("buildFlow: split steps, derived tables linked to their inputs", () => {
  const g = buildFlow(FLOW_SOURCES, TABLES, { group: null, steps: "split", derived: "inputs" });
  const has = (a: string, b: string) => g.edges.some((e) => e.source === a && e.target === b);
  assert.ok(has("origin:ERCOT", "ingest:ercot_tpit"));
  assert.ok(has("ingest:ercot_tpit", "process:ercot_tpit"));
  assert.ok(has("process:ercot_tpit", "table:tpit_projects"));
  assert.ok(has("table:tpit_projects", "table:tpit_project_history"));
  assert.ok(!has("process:ercot_tpit", "table:tpit_project_history"));
  assert.ok(has("table:tx_counties", "table:county_iso_share"));
  // No ingest step outside the lake; system tables stay out.
  assert.ok(has(`origin:${OUTSIDE_LAKE}`, "process:config_facts"));
  assert.ok(!g.byId.has("ingest:config_facts"));
  assert.ok(!g.byId.has("table:etl_run"));
  // The running process animates its edges.
  assert.ok(g.edges.find((e) => e.source === "process:ercot_large_load_decks")?.running);
});

test("buildFlow: merged steps and derived tables linked to their pipeline", () => {
  const g = buildFlow(FLOW_SOURCES, TABLES, { group: null, steps: "merged", derived: "pipeline" });
  const has = (a: string, b: string) => g.edges.some((e) => e.source === a && e.target === b);
  assert.ok(has("origin:ERCOT", "pipeline:ercot_tpit"));
  assert.ok(has("pipeline:ercot_tpit", "table:tpit_project_history"));
  assert.ok(!g.byId.has("ingest:ercot_tpit"));
});

test("buildFlow: a group shows inputs from other groups as external tables", () => {
  const g = buildFlow(FLOW_SOURCES, TABLES, { group: "PUCT", steps: "split", derived: "inputs" });
  const counties = g.byId.get("table:tx_counties");
  assert.equal(counties?.kind, "table");
  assert.equal(counties && "external" in counties && counties.external, true);
  assert.ok(!g.byId.has("process:census_tx_counties_geo"));
  assert.ok(!g.byId.has("table:tpit_projects"));
});

test("buildFlow: health of tables and origins", () => {
  const g = buildFlow(FLOW_SOURCES, TABLES, { group: null, steps: "split", derived: "inputs" });
  assert.equal(g.byId.get("table:large_load_status")?.health.status, "never");
  assert.equal(g.byId.get("table:county_iso_share")?.health.status, "failed");
  const ercot = g.byId.get("origin:ERCOT");
  assert.equal(ercot?.health.status, "running");
  assert.equal(ercot?.kind === "origin" && ercot.sources, 2);
  const puct = g.byId.get("origin:PUCT");
  assert.equal(puct?.kind === "origin" && puct.unhealthy, 1);
});

test("lineage walks both ways and keeps only path edges", () => {
  const g = buildFlow(FLOW_SOURCES, TABLES, { group: null, steps: "split", derived: "inputs" });
  const l = lineage(g, "table:tx_counties");
  assert.ok(l.up.has("origin:Census"));
  assert.ok(l.down.has("table:county_iso_share"));
  // county_iso_share's other input is downstream-adjacent but not on tx_counties' path.
  assert.ok(!l.nodes.has("table:puct_ccn_territories"));
  assert.ok(!l.edges.has("table:puct_ccn_territories>table:county_iso_share"));
  assert.ok(l.edges.has("table:tx_counties>table:county_iso_share"));
});

test("flowGroups keeps the filter order", () => {
  assert.deepEqual(
    flowGroups(FLOW_SOURCES).map((g) => g.group),
    ["ERCOT", "Census", "PUCT", "Other"],
  );
});

test("nodeIdForSteps maps a selection between step modes", () => {
  assert.equal(nodeIdForSteps("ingest:ercot_tpit", "merged"), "pipeline:ercot_tpit");
  assert.equal(nodeIdForSteps("process:ercot_tpit", "merged"), "pipeline:ercot_tpit");
  assert.equal(nodeIdForSteps("pipeline:ercot_tpit", "split"), "process:ercot_tpit");
  assert.equal(nodeIdForSteps("table:x", "split"), "table:x");
});

test("raw runs drive the ingest step: a failed fetch, a fetch in progress", () => {
  const rawRun = (source: string, status: string): Schemas["Run"] => ({ ...run(source, status, "2026-09-26T16:45:00Z"), stage: "raw" });
  const sources = collectSources(SOURCES, TABLES, [...RUNS, rawRun("ercot_tpit", "failed"), rawRun("census_tx_counties_geo", "running")], NOW);
  const tpit = sources.find((s) => s.id === "ercot_tpit");
  assert.equal(tpit?.ingest.status, "failed");
  // The last good fetch still dates the data.
  assert.equal(tpit?.ingest.updatedAt, "2026-09-26T05:32:12Z");
  const g = buildFlow(sources, TABLES, { group: null, steps: "split", derived: "inputs" });
  assert.ok(g.edges.find((e) => e.id === "origin:Census>ingest:census_tx_counties_geo")?.running);
  assert.equal(g.byId.get("origin:ERCOT")?.health.status, "failed");
});
