/**
 * Records the static snapshot the app serves in place of basecast-get-data (docs/decisions.md, 2026-09-29).
 * It crawls the live API once: every resource the screens read, with every parameter they can send, taking
 * the choices (variants, regions, dates, counties, accounts, tables, folders) from the answers themselves.
 * The run logs of the model runs come from `ops.log` in Postgres. Layout: `src/lib/snapshot/paths.ts`.
 *
 *   GET_DATA_URL=https://<get-data> GET_DATA_TOKEN=... DATABASE_URL=... npx tsx scripts/snapshot/record.ts
 *
 * It needs get-data and Cloud SQL alive, which are gone after the GCP teardown: the script stays as the record
 * of how the snapshot was made.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gzipSync } from "node:zlib";

import pg from "pg";

import { files, MANIFEST, type Manifest, SINGLES, TABLE_SAMPLE, WHOLE_TABLES } from "../../src/lib/snapshot/paths";

const ROOT = join(process.cwd(), "snapshot");
const PAGE = 1000;
const CONCURRENCY = 6;

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const API = required("GET_DATA_URL").replace(/\/+$/, "");
const TOKEN = required("GET_DATA_TOKEN");

type Params = Record<string, string | number | boolean | string[] | undefined>;
type Answer = { status: number; body: unknown };
type Envelope<T> = { meta: Record<string, unknown>; data: T };

let calls = 0;

async function get(path: string, params: Params = {}): Promise<Answer> {
  const url = new URL(`${API}/${path}`);
  for (const [name, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(name, v));
    else url.searchParams.set(name, String(value));
  }
  for (let attempt = 1; ; attempt++) {
    try {
      calls++;
      const response = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
      if (response.status >= 500 && attempt < 3) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const json = (response.headers.get("content-type") ?? "").includes("json");
      return { status: response.status, body: json ? JSON.parse(text) : text };
    } catch (error) {
      if (attempt >= 3) throw new Error(`${url.pathname}${url.search}: ${String(error)}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function ok<T>(path: string, params?: Params): Promise<T> {
  const answer = await get(path, params);
  if (answer.status !== 200) throw new Error(`${path} ${JSON.stringify(params ?? {})}: HTTP ${answer.status}`);
  return answer.body as T;
}

let written = 0;
let bytes = 0;

/** The same object with its keys sorted, so a re-recording diffs cleanly whatever order the calls ended in. */
const sorted = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

function write(rel: string, value: unknown): void {
  const path = join(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  const raw = typeof value === "string" ? value : JSON.stringify(value);
  const body = rel.endsWith(".gz") ? gzipSync(raw, { level: 9 }) : raw;
  writeFileSync(path, body);
  written++;
  bytes += body.length;
}

async function pool<T>(items: T[], fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) await fn(items[next++]);
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
}

/** Every page of a paged list, as one page holding all of it. */
async function whole<I>(
  path: string,
  params: Params,
  itemsOf: (data: Record<string, unknown>) => I[],
  totalOf: (data: Record<string, unknown>) => number | null,
): Promise<{ first: Envelope<Record<string, unknown>>; items: I[] }> {
  const first = await ok<Envelope<Record<string, unknown>>>(path, { ...params, offset: 0, limit: PAGE });
  const items = [...itemsOf(first.data)];
  const total = totalOf(first.data);
  let page = itemsOf(first.data).length;
  while (page === PAGE && (total === null || items.length < total)) {
    const next = await ok<Envelope<Record<string, unknown>>>(path, { ...params, offset: items.length, limit: PAGE });
    page = itemsOf(next.data).length;
    items.push(...itemsOf(next.data));
  }
  return { first, items };
}

function log(step: string) {
  console.log(`${new Date().toISOString().slice(11, 19)}  ${step}  (${calls} calls, ${written} files, ${(bytes / 1e6).toFixed(1)} MB)`);
}

// ---------------------------------------------------------------------------------------------------------

type Variant = { variant: string; regions: string[] };
type AccountItem = {
  account_id: string;
  account_type: string;
  tier: string;
  next_action: string;
  active_triggers: string[];
  primary_weather_zone: string | null;
  gt: string | null;
};
type CountyItem = { county_fips: string };
type TableItem = { name: string; rows: number | null };
type Folder = { prefix: string };
type LakeObject = { key: string };
type Listing = { prefix: string; folders: Folder[]; objects: LakeObject[]; total_objects: number; offset: number; limit: number };
type Run = { run_id: string; source: string; stage: string };

async function main() {
  rmSync(ROOT, { recursive: true, force: true });
  mkdirSync(ROOT, { recursive: true });
  const counts: Record<string, number> = {};

  const singles: Record<string, unknown> = {};
  await pool([...SINGLES], async (path) => {
    singles[path] = await ok(path);
    write(files.single(path), singles[path]);
  });
  log("singles");

  // Forecast: every variant over each region it covers.
  const peak = await ok<Envelope<{ variant: string; region: string; variants: Variant[] }>>("forecasts/peak");
  const peakCombos = peak.data.variants.flatMap((v) => v.regions.map((region) => ({ variant: v.variant, region })));
  await pool(peakCombos, async ({ variant, region }) => write(files.peak(variant, region), await ok("forecasts/peak", { variant, region })));
  counts.peak = peakCombos.length;

  const normalized = await ok<Envelope<{ region: string; regions: string[] }>>("load/normalized");
  await pool(normalized.data.regions, async (region) => write(files.normalized(region), await ok("load/normalized", { region })));
  counts.normalized = normalized.data.regions.length;

  const backtest = await ok<Envelope<{ as_of: string; as_of_dates: string[] }>>("backtest/peak");
  await pool(backtest.data.as_of_dates, async (as_of) => write(files.backtestPeak(as_of), await ok("backtest/peak", { as_of })));
  counts.backtestPeak = backtest.data.as_of_dates.length;
  log("forecast and backtest");

  // Explorer: each layer's horizon × stratum, then every county.
  const counties = await ok<Envelope<{ items: CountyItem[]; horizon: number; stratum: string; horizons: number[]; strata: string[] }>>(
    "geo/counties",
  );
  const layers = counties.data.horizons.flatMap((horizon) => counties.data.strata.map((stratum) => ({ horizon, stratum })));
  await pool(layers, async ({ horizon, stratum }) => write(files.countiesLayer(horizon, stratum), await ok("geo/counties", { horizon, stratum })));
  const fipsList = counties.data.items.map((c) => c.county_fips);
  let countyDetails = 0;
  await pool(fipsList, async (fips) => {
    const answer = await get(`geo/counties/${fips}`);
    if (answer.status === 200) {
      write(files.county(fips), answer.body);
      countyDetails++;
    } else if (answer.status !== 404) throw new Error(`geo/counties/${fips}: HTTP ${answer.status}`);
  });
  counts.countyDetails = countyDetails;
  log("explorer");

  // Accounts: the whole list and CSV, who covers each county, every diagnosis and its full event history.
  const accounts = await ok<Envelope<{ items: AccountItem[] }>>("accounts");
  write(files.accounts, accounts);
  const csv = await get("accounts/export.csv");
  if (csv.status !== 200 || typeof csv.body !== "string") throw new Error("accounts/export.csv failed");
  write(files.accountsCsv, csv.body);
  const byCounty: Record<string, string[]> = {};
  await pool(fipsList, async (county) => {
    const answer = await ok<Envelope<{ items: AccountItem[] }>>("accounts", { county });
    if (answer.data.items.length) byCounty[county] = answer.data.items.map((a) => a.account_id);
  });
  write(files.accountsByCounty, sorted(byCounty));
  const ids = accounts.data.items.map((a) => a.account_id);
  await pool(ids, async (id) => {
    write(files.account(id), await ok(`accounts/${id}`));
    const events = await ok<Envelope<{ items: unknown[]; total: number }>>(`accounts/${id}/events`, { limit: 500 });
    const items = [...events.data.items];
    while (items.length < events.data.total) {
      const next = await ok<Envelope<{ items: unknown[] }>>(`accounts/${id}/events`, { limit: 500, offset: items.length });
      items.push(...next.data.items);
    }
    write(files.events(id), { meta: events.meta, data: { items, total: items.length, offset: 0, limit: items.length } });
  });
  counts.accounts = ids.length;
  log("accounts");

  await recordParity(accounts.data.items, Object.keys(byCounty));
  log("parity");

  // Data browser: each table's detail, first rows and lineage.
  const tables = (singles.tables as Envelope<{ items: TableItem[] }>).data.items;
  let tableRows: Manifest["tableRows"] = {};
  await pool(tables, async (t) => {
    write(files.table(t.name), await ok(`tables/${t.name}`));
    if (WHOLE_TABLES.has(t.name)) {
      const { first, items } = await whole(`tables/${t.name}/rows`, {}, (d) => d.rows as unknown[], () => null);
      write(files.tableRows(t.name), { ...first, data: { ...first.data, rows: items, offset: 0, limit: items.length } });
      tableRows[t.name] = { kept: items.length, rows: t.rows };
    } else {
      const answer = await get(`tables/${t.name}/rows`, { limit: TABLE_SAMPLE });
      if (answer.status === 200) {
        const rows = (answer.body as Envelope<{ rows: unknown[] }>).data.rows;
        write(files.tableRows(t.name), answer.body);
        tableRows[t.name] = { kept: rows.length, rows: t.rows };
      } else {
        console.warn(`  rows of ${t.name}: HTTP ${answer.status}, not kept`);
      }
    }
    const lineage = await whole(`tables/${t.name}/lineage`, {}, (d) => d.items as unknown[], (d) => d.total as number);
    write(files.lineage(t.name), {
      ...lineage.first,
      data: { items: lineage.items, total: lineage.items.length, offset: 0, limit: lineage.items.length },
    });
  });
  tableRows = sorted(tableRows);
  counts.tables = tables.length;
  log("tables");

  // The lake: every folder's listing, whole, then every file's detail.
  const listings: Record<string, Envelope<Listing>> = {};
  let queue = [""];
  while (queue.length) {
    const found: string[] = [];
    await pool(queue, async (prefix) => {
      const first = await ok<Envelope<Listing>>("lake/list", { prefix, limit: PAGE });
      const objects = [...first.data.objects];
      while (objects.length < first.data.total_objects) {
        const next = await ok<Envelope<Listing>>("lake/list", { prefix, limit: PAGE, offset: objects.length });
        objects.push(...next.data.objects);
      }
      listings[prefix] = { ...first, data: { ...first.data, objects, offset: 0, limit: objects.length } };
      found.push(...first.data.folders.map((f) => f.prefix));
    });
    queue = found;
  }
  write(files.lakeListings, sorted(listings));
  const keys = Object.values(listings).flatMap((l) => l.data.objects.map((o) => o.key));
  const objects: Record<string, Answer> = {};
  await pool(keys, async (key) => {
    const answer = await get("lake/object", { key });
    if (answer.status === 200) objects[key] = answer;
  });
  write(files.lakeObjects, sorted(objects));
  counts.lakeFolders = Object.keys(listings).length;
  counts.lakeFiles = Object.keys(objects).length;
  log("lake");

  // Pipeline runs, whole, and the model runs' log lines.
  const runs = await whole("pipeline/runs", {}, (d) => d.items as Run[], (d) => d.total as number);
  write(files.runs, { ...runs.first, data: { items: runs.items, total: runs.items.length, offset: 0, limit: runs.items.length } });
  counts.runs = runs.items.length;
  const modelRuns = runs.items.filter((r) => r.source === "marts" && r.stage === "model").map((r) => r.run_id);
  counts.runLogs = await recordRunLogs(modelRuns);
  log("runs");

  const manifest: Manifest = {
    recordedAt: new Date().toISOString(),
    source: API,
    defaults: {
      peakVariant: peak.data.variant,
      peakRegion: peak.data.region,
      normalizedRegion: normalized.data.region,
      backtestAsOf: backtest.data.as_of,
      countiesHorizon: counties.data.horizon,
      countiesStratum: counties.data.stratum,
    },
    tableRows,
    counts,
  };
  write(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");
  log("done");
}

/** A few filtered answers of the live API, to test the reader's filters against (`snapshot/*.test.ts`). */
async function recordParity(items: AccountItem[], counties: string[]) {
  const first = <K extends keyof AccountItem>(key: K) => [...new Set(items.map((a) => a[key]).filter(Boolean))] as string[];
  const triggers = [...new Set(items.flatMap((a) => a.active_triggers))];
  const accountQueries: Params[] = [
    ...first("account_type").map((type) => ({ type })),
    ...first("tier").map((tier) => ({ tier })),
    ...first("next_action").map((next_action) => ({ next_action })),
    { trigger: triggers.slice(0, 2) },
    { zone: first("primary_weather_zone").slice(0, 2) },
    { gt: first("gt").slice(0, 1) },
    ...counties.slice(0, 3).map((county) => ({ county })),
    { q: "electric" },
    { q: "  CITY " },
    { rank_scope: "within_type" },
    { type: "coop", tier: ["A", "B"], rank_scope: "within_type" },
    { sort: "score", desc: true },
    { sort: "name" },
    { sort: "meters", desc: true },
    { sort: "latest_event_date", desc: true },
    { sort: "action_changes_on" },
  ];
  const accounts = [];
  for (const params of accountQueries) {
    const answer = await ok<Envelope<{ items: AccountItem[]; total: number }>>("accounts", params);
    accounts.push({ params, ids: answer.data.items.map((a) => a.account_id), total: answer.data.total });
  }
  const csv = [];
  for (const params of [{ type: "muni" }, { tier: "A", rank_scope: "within_type" }] as Params[]) {
    csv.push({ params, text: (await get("accounts/export.csv", params)).body });
  }
  const busiest = [...items].sort((a, b) => b.active_triggers.length - a.active_triggers.length).slice(0, 2);
  const events = [];
  for (const a of busiest) {
    for (const params of [
      { limit: 10 },
      { offset: 5, limit: 7 },
      { strength: "strong" },
      { since: "2025-01-01" },
      { trigger: a.active_triggers.slice(0, 1) },
    ] as Params[]) {
      const answer = await ok<Envelope<unknown>>(`accounts/${a.account_id}/events`, params);
      events.push({ id: a.account_id, params, data: answer.data });
    }
  }
  write(files.parity, { accounts, csv, events });
}

/** `ops.log` of each model run, as the /ops logs route answered it (newest first, at most 200 lines). */
async function recordRunLogs(runIds: string[]): Promise<number> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.warn("  DATABASE_URL is not set: no run logs");
    write(files.runLogs, {});
    return 0;
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(
      `SELECT id::text, ts, service, env, level, event, message, request_id, run_id, user_id, method, route,
         status, duration_ms, error_class, error_stack, fingerprint, version, host, context
       FROM ops.log WHERE run_id = ANY($1) ORDER BY ts DESC, id DESC`,
      [runIds],
    );
    const byRun: Record<string, { entries: unknown[]; levelCounts: Record<string, number>; nextBefore: null }> = {};
    for (const r of rows) {
      const page = (byRun[r.run_id] ??= { entries: [], levelCounts: { info: 0, warn: 0, error: 0 }, nextBefore: null });
      if (r.level in page.levelCounts) page.levelCounts[r.level]++;
      if (page.entries.length >= 200) continue;
      page.entries.push({
        id: r.id, ts: (r.ts as Date).toISOString(), service: r.service, env: r.env, level: r.level, event: r.event,
        message: r.message, requestId: r.request_id, runId: r.run_id, userId: r.user_id, method: r.method,
        route: r.route, status: r.status, durationMs: r.duration_ms, errorClass: r.error_class,
        errorStack: r.error_stack, fingerprint: r.fingerprint, version: r.version, host: r.host, context: r.context,
      });
    }
    write(files.runLogs, sorted(byRun));
    return Object.keys(byRun).length;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
