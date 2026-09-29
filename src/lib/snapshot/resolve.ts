import { files, type Single,SINGLES } from "./paths";
import type { Reader } from "./reader";

/**
 * Answers a get-data request from the recorded snapshot, as get-data answered it: the same envelope, the same
 * statuses (404 `not_found`, 422 `invalid_as_of`) and the same filters, ported from basecast-get-data's
 * routers where a screen can send open-ended parameters (accounts, events, runs, rows, the lake's listings).
 * The file previews and downloads are not in the snapshot.
 */

export type Answer = { status: number; body: unknown; headers?: Record<string, string> };

type Envelope<T> = { meta: Record<string, unknown>; data: T };

const ok = (body: unknown): Answer => ({ status: 200, body });
const fail = (status: number, detail: string, extra: Record<string, unknown> = {}): Answer => ({
  status,
  body: { detail, ...extra },
});
const NOT_FOUND = fail(404, "not_found");
const NOT_RECORDED = fail(404, "Not in the static snapshot");

const ACCOUNT = /^accounts\/([A-Za-z0-9_-]{1,32})$/;
const EVENTS = /^accounts\/([A-Za-z0-9_-]{1,32})\/events$/;
const COUNTY = /^geo\/counties\/(\d{5})$/;
const TABLE = /^tables\/([A-Za-z_][A-Za-z0-9_]{0,62})(\/rows|\/lineage)?$/;
const RUN_LOGS = /^ops-log\/runs\/([A-Za-z0-9_-]{1,64})$/;

export function resolve(path: string, search: URLSearchParams, read: Reader): Answer {
  const recorded = (file: string, missing = NOT_FOUND): Answer => {
    const body = read.json(file);
    return body === null ? missing : ok(body);
  };
  const defaults = read.manifest().defaults;
  const param = (name: string) => search.get(name) || null;
  let m: RegExpMatchArray | null;

  if ((SINGLES as readonly string[]).includes(path)) return recorded(files.single(path as Single), NOT_RECORDED);

  switch (path) {
    case "forecasts/peak":
      return recorded(files.peak(param("variant") ?? defaults.peakVariant, param("region") ?? defaults.peakRegion), NOT_RECORDED);
    case "load/normalized":
      return recorded(files.normalized(param("region") ?? defaults.normalizedRegion), NOT_RECORDED);
    case "backtest/peak":
      return backtestPeak(param("as_of") ?? defaults.backtestAsOf, read);
    case "geo/counties":
      return recorded(
        files.countiesLayer(Number(param("horizon") ?? defaults.countiesHorizon), param("stratum") ?? defaults.countiesStratum),
        fail(422, "horizon or stratum out of range"),
      );
    case "accounts":
      return accounts(search, read);
    case "accounts/export.csv":
      return accountsCsv(search, read);
    case "pipeline/runs":
      return runs(search, read);
    case "lake/list":
      return lakeList(search, read);
    case "lake/object": {
      const key = param("key");
      const found = key ? read.json<Record<string, Answer>>(files.lakeObjects)?.[key] : undefined;
      return found ?? fail(404, `no such object: ${key}`);
    }
  }

  if ((m = path.match(COUNTY))) return recorded(files.county(m[1]));
  if ((m = path.match(ACCOUNT))) return recorded(files.account(m[1]));
  if ((m = path.match(EVENTS))) return events(m[1], search, read);
  if ((m = path.match(TABLE))) {
    const [, name, part] = m;
    if (!read.json(files.table(name))) return fail(404, `no such table: ${name}`);
    if (!part) return recorded(files.table(name));
    if (part === "/lineage") return paged(read.json(files.lineage(name)), search, 200);
    return rows(read.json(files.tableRows(name)), search);
  }
  if ((m = path.match(RUN_LOGS))) {
    const page = read.json<Record<string, unknown>>(files.runLogs)?.[m[1]];
    return ok(page ?? { entries: [], levelCounts: { info: 0, warn: 0, error: 0 }, nextBefore: null });
  }
  return NOT_RECORDED;
}

// --- helpers ----------------------------------------------------------------------------------------------

function int(search: URLSearchParams, name: string, fallback: number): number {
  const raw = search.get(name);
  const value = raw === null || raw === "" ? fallback : Number(raw);
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

const truthy = (value: string | null) => value === "true" || value === "1";

/** A slice of a list recorded whole (`{items, total, offset, limit}`), by `offset` and `limit`. */
function paged(recorded: Envelope<{ items: unknown[] }> | null, search: URLSearchParams, fallbackLimit: number): Answer {
  if (!recorded) return NOT_RECORDED;
  return ok(page(recorded, recorded.data.items, search, fallbackLimit));
}

function page<I>(recorded: Envelope<object>, items: I[], search: URLSearchParams, fallbackLimit: number) {
  const offset = int(search, "offset", 0);
  const limit = int(search, "limit", fallbackLimit) || fallbackLimit;
  return { ...recorded, data: { ...recorded.data, items: items.slice(offset, offset + limit), total: items.length, offset, limit } };
}

/** Polars' `sort(..., nulls_last=True)`: `desc` flips the first key only; nulls last either way. */
function compareBy<T>(keys: ((item: T) => unknown)[], desc: boolean) {
  return (a: T, b: T): number => {
    for (const [i, key] of keys.entries()) {
      const x = key(a);
      const y = key(b);
      if (x === y) continue;
      if (x === null || x === undefined) return 1;
      if (y === null || y === undefined) return -1;
      const order = (x as number | string) < (y as number | string) ? -1 : 1;
      return i === 0 && desc ? -order : order;
    }
    return 0;
  };
}

// --- backtest ---------------------------------------------------------------------------------------------

function backtestPeak(asOf: string, read: Reader): Answer {
  const body = read.json(files.backtestPeak(asOf));
  if (body) return ok(body);
  const latest = read.json<Envelope<{ as_of_dates: string[] }>>(files.backtestPeak(read.manifest().defaults.backtestAsOf));
  return fail(422, "invalid_as_of", { as_of_dates: latest?.data.as_of_dates ?? [] });
}

// --- accounts (basecast-get-data routers/accounts.py) -----------------------------------------------------

type AccountRow = Record<string, unknown> & {
  account_id: string;
  name: string;
  active_triggers: string[];
};
type AccountsData = { items: AccountRow[]; total: number; rank_scope: string };

const ACCOUNT_LISTS: [param: string, column: string][] = [
  ["type", "account_type"],
  ["tier", "tier"],
  ["next_action", "next_action"],
  ["zone", "primary_weather_zone"],
  ["gt", "gt"],
];

/** `_filtered`: the list filters AND-combined, then the sort, over the recorded unfiltered list. */
export function filterAccounts(items: AccountRow[], search: URLSearchParams, byCounty: Record<string, string[]>): AccountRow[] {
  let out = items;
  for (const [name, column] of ACCOUNT_LISTS) {
    const values = search.getAll(name).filter(Boolean);
    if (values.length) out = out.filter((a) => values.includes(a[column] as string));
  }
  const triggers = search.getAll("trigger").filter(Boolean);
  if (triggers.length) out = out.filter((a) => a.active_triggers.some((t) => triggers.includes(t)));
  const county = search.get("county");
  if (county) {
    const covering = new Set(byCounty[county] ?? []);
    out = out.filter((a) => covering.has(a.account_id));
  }
  const q = search.get("q")?.trim().toLowerCase();
  if (q) out = out.filter((a) => a.name.toLowerCase().includes(q));

  const sort = search.get("sort") || "rank";
  const withinType = search.get("rank_scope") === "within_type";
  const by = sort === "rank" ? (withinType ? ["account_type", "rank_within_type"] : ["rank"]) : [sort, "rank"];
  return [...out].sort(compareBy<AccountRow>(by.map((column) => (a) => a[column]), truthy(search.get("desc"))));
}

function accountList(search: URLSearchParams, read: Reader): { recorded: Envelope<AccountsData>; items: AccountRow[] } | null {
  const recorded = read.json<Envelope<AccountsData>>(files.accounts);
  if (!recorded) return null;
  const byCounty = read.json<Record<string, string[]>>(files.accountsByCounty) ?? {};
  return { recorded, items: filterAccounts(recorded.data.items, search, byCounty) };
}

function accounts(search: URLSearchParams, read: Reader): Answer {
  const list = accountList(search, read);
  if (!list) return NOT_RECORDED;
  const rankScope = search.get("rank_scope") === "within_type" ? "within_type" : "all";
  return ok({ ...list.recorded, data: { ...list.recorded.data, items: list.items, total: list.items.length, rank_scope: rankScope } });
}

/** CSV records with their line ends, a quoted field's line breaks kept inside its record. */
export function csvRecords(text: string): string[] {
  const records: string[] = [];
  let start = 0;
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') quoted = !quoted;
    else if (c === "\n" && !quoted) {
      records.push(text.slice(start, i + 1));
      start = i + 1;
    }
  }
  if (start < text.length) records.push(text.slice(start));
  return records;
}

/** The recorded CSV's rows (the first column is `account_id`) in the filtered list's order. */
function accountsCsv(search: URLSearchParams, read: Reader): Answer {
  const list = accountList(search, read);
  const text = read.text(files.accountsCsv);
  if (!list || text === null) return NOT_RECORDED;
  const [header, ...records] = csvRecords(text);
  const byId = new Map(records.map((r) => [r.slice(0, r.indexOf(",")), r]));
  const asOf = (list.recorded.meta.data_as_of as string | null) ?? read.manifest().recordedAt.slice(0, 10);
  return {
    status: 200,
    body: header + list.items.map((a) => byId.get(a.account_id) ?? "").join(""),
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="basecast-accounts-${asOf}.csv"`,
    },
  };
}

type EventRow = { event_date: string; trigger: string; strength: string };

/** `account_events`: newest first as recorded, filtered by `since`, `trigger` and `strength`, then paged. */
function events(id: string, search: URLSearchParams, read: Reader): Answer {
  const recorded = read.json<Envelope<{ items: EventRow[] }>>(files.events(id));
  if (!recorded) return NOT_FOUND;
  let items = recorded.data.items;
  const since = search.get("since");
  if (since) items = items.filter((e) => e.event_date >= since);
  const triggers = search.getAll("trigger").filter(Boolean);
  if (triggers.length) items = items.filter((e) => triggers.includes(e.trigger));
  const strength = search.get("strength");
  if (strength) items = items.filter((e) => e.strength === strength);
  return ok(page(recorded, items, search, 50));
}

// --- pipeline runs (routers/pipeline.py) ------------------------------------------------------------------

function runs(search: URLSearchParams, read: Reader): Answer {
  const recorded = read.json<Envelope<{ items: Record<string, unknown>[] }>>(files.runs);
  if (!recorded) return NOT_RECORDED;
  let items = recorded.data.items;
  for (const column of ["source", "stage", "status"]) {
    const value = search.get(column);
    if (value) items = items.filter((r) => r[column] === value);
  }
  return ok(page(recorded, items, search, 100));
}

// --- table rows (routers/tables.py, tables/filters.py) ----------------------------------------------------

type RowsData = { columns: { name: string }[]; rows: unknown[][]; offset: number; limit: number; total: number | null };

const SEP = "\x1f";
const FILTER_OPS = new Set(["eq", "ne", "contains", "starts", "in", "gte", "lte", "gt", "lt", "between", "null", "notnull"]);

function compareCell(cell: unknown, value: string): number {
  const n = Number(value);
  if (typeof cell === "number" && value.trim() !== "" && !Number.isNaN(n)) return cell - n;
  const text = typeof cell === "string" ? cell : JSON.stringify(cell);
  return text < value ? -1 : text > value ? 1 : 0;
}

const asText = (cell: unknown) => (typeof cell === "string" ? cell : JSON.stringify(cell));

function matches(cell: unknown, op: string, values: string[]): boolean {
  if (op === "null") return cell === null || cell === undefined;
  if (op === "notnull") return cell !== null && cell !== undefined;
  if (op === "ne") return cell === null || cell === undefined || compareCell(cell, values[0]) !== 0;
  if (cell === null || cell === undefined) return false;
  switch (op) {
    case "eq":
      return compareCell(cell, values[0]) === 0;
    case "contains":
      return asText(cell).toLowerCase().includes(values[0].toLowerCase());
    case "starts":
      return asText(cell).toLowerCase().startsWith(values[0].toLowerCase());
    case "in":
      return values.includes(asText(cell));
    case "gte":
      return compareCell(cell, values[0]) >= 0;
    case "lte":
      return compareCell(cell, values[0]) <= 0;
    case "gt":
      return compareCell(cell, values[0]) > 0;
    case "lt":
      return compareCell(cell, values[0]) < 0;
    case "between":
      return compareCell(cell, values[0]) >= 0 && compareCell(cell, values[1]) <= 0;
  }
  return false;
}

/**
 * The recorded rows of a table (its first rows, or all of a small one) with get-data's `filter`, `sort`,
 * `desc`, `offset`, `limit` and `with_summary` applied to them.
 */
function rows(recorded: Envelope<RowsData> | null, search: URLSearchParams): Answer {
  if (!recorded) return NOT_RECORDED;
  const names = recorded.data.columns.map((c) => c.name);
  let out = recorded.data.rows;
  for (const raw of search.getAll("filter")) {
    const [column, op, ...rest] = raw.split(":");
    const value = rest.join(":");
    const index = names.indexOf(column);
    if (index < 0) return fail(422, `unknown column '${column}'`);
    if (!FILTER_OPS.has(op)) return fail(422, `unknown filter op '${op}'`);
    const values = op === "in" || op === "between" ? value.split(SEP) : [value];
    out = out.filter((row) => matches(row[index], op, values));
  }
  const sort = search.get("sort");
  if (sort) {
    const index = names.indexOf(sort);
    if (index < 0) return fail(422, `unknown sort column '${sort}'`);
    out = [...out].sort(compareBy<unknown[]>([(row) => row[index]], truthy(search.get("desc"))));
  }
  const offset = int(search, "offset", 0);
  const limit = int(search, "limit", 500) || 500;
  return ok({
    ...recorded,
    data: {
      ...recorded.data,
      rows: out.slice(offset, offset + limit),
      offset,
      limit,
      total: truthy(search.get("with_summary")) ? out.length : null,
      total_estimated: false,
    },
  });
}

// --- the lake (routers/lake.py) ---------------------------------------------------------------------------

type LakeListing = {
  prefix: string;
  folders: { name: string; prefix: string }[];
  objects: { key: string; source_id: string; dt: string; file: string }[];
  total_objects: number;
};

/** The lake index's order: source, then snapshot date, then file name. */
const byObject = compareBy<LakeListing["objects"][number]>([(o) => o.source_id, (o) => o.dt, (o) => o.file], false);

const DT_FOLDER = /^raw\/source=[^/]+\/dt=[^/]+\/$/;

function lakeList(search: URLSearchParams, read: Reader): Answer {
  const prefix = search.get("prefix") ?? "";
  if (prefix && !prefix.endsWith("/")) return fail(422, "prefix must end with '/'");
  const listings = read.json<Record<string, Envelope<LakeListing>>>(files.lakeListings);
  if (!listings) return NOT_RECORDED;
  const recorded = listings[prefix];
  if (!recorded) return fail(404, `no such folder: ${prefix}`);

  let { folders, objects } = recorded.data;
  if (prefix.startsWith("raw/") && truthy(search.get("recursive"))) {
    folders = [];
    objects = Object.entries(listings)
      .filter(([p]) => DT_FOLDER.test(p) && p.startsWith(prefix))
      .flatMap(([, l]) => l.data.objects)
      .sort(byObject);
  }
  const needle = search.get("q")?.trim().toLowerCase();
  if (needle) {
    folders = folders.filter((f) => f.name.toLowerCase().includes(needle));
    objects = objects.filter((o) => o.file.toLowerCase().includes(needle));
  }
  const offset = int(search, "offset", 0);
  const limit = int(search, "limit", 500) || 500;
  return ok({
    ...recorded,
    data: { ...recorded.data, folders, objects: objects.slice(offset, offset + limit), total_objects: objects.length, offset, limit },
  });
}
