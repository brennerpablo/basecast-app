/**
 * Model runs (the mart builds, `etl_run` rows with `source = marts`, `stage = model`) as the app reads them from
 * get-data's `/tables/etl_run/rows`: the row, its `params` (the marts built, the as-of date, the code sha) and its
 * `events` (one `mart.check` per golden or structural check with expected and actual, `mart.built` per mart
 * written, `mart.skipped` and `error`). Pure: parsing, grouping by mart in build order, tallies and the link from
 * a mart to the run that built it.
 */
import type { components } from "@/lib/api/get-data";

export type RowsPage = components["schemas"]["RowsPage"];

export const MODEL_RUN_FILTERS = ["source:eq:marts", "stage:eq:model"];

export type MartCheck = {
  at: string;
  mart: string;
  check: string;
  status: "passed" | "failed" | "skipped" | string;
  expected?: unknown;
  actual?: unknown;
  reason?: string;
  error?: string;
};

export type MartBuilt = { at: string; mart: string; rows: number | null; asOf: string | null; durationS: number | null; modelVersion: string | null };

export type RunIssue = { at: string; kind: "error" | "mart.skipped"; mart: string | null; text: string };

export type ModelRun = {
  runId: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationS: number | null;
  rows: number | null;
  error: string | null;
  code: string | null;
  asOf: string | null;
  dryRun: boolean;
  marts: string[];
  checks: MartCheck[];
  built: MartBuilt[];
  issues: RunIssue[];
};

const json = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const str = (value: unknown) => (typeof value === "string" ? value : null);
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** One `etl_run` row from a rows page (columns by name); `events` and `params` may come as JSON text. */
export function parseRun(row: Record<string, unknown>): ModelRun {
  const params = (json(row.params) ?? {}) as Record<string, unknown>;
  const events = (Array.isArray(json(row.events)) ? json(row.events) : []) as Record<string, unknown>[];
  const checks: MartCheck[] = [];
  const built: MartBuilt[] = [];
  const issues: RunIssue[] = [];
  for (const e of events) {
    const at = str(e.at) ?? "";
    if (e.kind === "mart.check") {
      checks.push({
        at,
        mart: str(e.mart) ?? "",
        check: str(e.check) ?? "",
        status: str(e.status) ?? "unknown",
        ...("expected" in e ? { expected: e.expected } : {}),
        ...("actual" in e ? { actual: e.actual } : {}),
        ...(str(e.reason) ? { reason: str(e.reason)! } : {}),
        ...(str(e.error) ? { error: str(e.error)! } : {}),
      });
    } else if (e.kind === "mart.built") {
      built.push({
        at,
        mart: str(e.mart) ?? "",
        rows: num(e.rows),
        asOf: str(e.as_of),
        durationS: num(e.duration_s),
        modelVersion: str(e.model_version),
      });
    } else if (e.kind === "error" || e.kind === "mart.skipped") {
      issues.push({ at, kind: e.kind, mart: str(e.mart), text: str(e.error) ?? str(e.reason) ?? "" });
    }
  }
  return {
    runId: str(row.run_id) ?? "",
    status: str(row.status) ?? "unknown",
    startedAt: str(row.started_at) ?? "",
    finishedAt: str(row.finished_at),
    durationS: num(row.duration_s),
    rows: num(row.rows),
    error: str(row.error),
    code: str(params.code),
    asOf: str(params.as_of),
    dryRun: params.dry_run === true,
    marts: Array.isArray(params.marts) ? params.marts.filter((m): m is string => typeof m === "string") : [],
    checks,
    built,
    issues,
  };
}

/** A rows page's runs, newest first. */
export function parseRuns(page: RowsPage): ModelRun[] {
  const names = page.columns.map((c) => c.name);
  return page.rows
    .map((row) => parseRun(Array.isArray(row) ? Object.fromEntries(names.map((n, i) => [n, row[i]])) : (row as Record<string, unknown>)))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export type Tally = { passed: number; failed: number; skipped: number; total: number };

export function tally(checks: MartCheck[]): Tally {
  const count = (status: string) => checks.filter((c) => c.status === status).length;
  return { passed: count("passed"), failed: count("failed"), skipped: count("skipped"), total: checks.length };
}

export type MartStep = { mart: string; checks: MartCheck[]; built: MartBuilt | null; issues: RunIssue[] };

/**
 * The run as its steps, one per mart in the order the build ran them (`params.marts`, then any mart only the
 * events name): its checks, what it wrote, and its skips and errors.
 */
export function stepsOf(run: ModelRun): MartStep[] {
  const order = [...run.marts];
  for (const name of [...run.checks.map((c) => c.mart), ...run.built.map((b) => b.mart)]) {
    if (name && !order.includes(name)) order.push(name);
  }
  return order.map((mart) => ({
    mart,
    checks: run.checks.filter((c) => c.mart === mart),
    built: run.built.find((b) => b.mart === mart) ?? null,
    issues: run.issues.filter((i) => i.mart === mart),
  }));
}

/** The newest run that wrote `mart` (its `mart.built` event): the build behind what a screen shows. */
export function runThatBuilt(runs: ModelRun[], mart: string): ModelRun | null {
  return [...runs].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).find((r) => r.built.some((b) => b.mart === mart)) ?? null;
}

/** A check's expected or actual value as text: numbers grouped, booleans as words. */
export function checkValue(value: unknown): string {
  if (value === undefined) return "";
  if (value === null) return "null";
  if (typeof value === "number") return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

/** actual − expected when both are numbers and differ; null otherwise. */
export function checkDelta(check: MartCheck): number | null {
  const { expected, actual } = check;
  if (typeof expected !== "number" || typeof actual !== "number" || expected === actual) return null;
  return actual - expected;
}

export const shortRunId = (runId: string) => runId.slice(0, 8);

/** The screen that reads a mart, for the run page's links. */
export function martScreen(mart: string): { href: string; label: string } | null {
  const m = mart.replace(/^mart_/, "");
  if (/^(peak_backtest|backtest_fan|official_forecast_errors|queue_backtest|actual_summer_peaks)$/.test(m)) return { href: "/backtest", label: "Backtest" };
  if (/^four_cp_/.test(m)) return { href: "/forecast?tab=4cp", label: "Forecast · 4CP" };
  if (/^load_normalized_/.test(m)) return { href: "/forecast?tab=normalized", label: "Forecast · Normalized" };
  if (m === "queue_stage_curves") return { href: "/forecast?tab=queue", label: "Forecast · Queue" };
  if (/^(peak_forecast|official_peak_lines|large_load_)/.test(m)) return { href: "/forecast", label: "Forecast" };
  if (/^(account|glossary$)/.test(m)) return { href: "/accounts", label: "Accounts" };
  if (/^(queue_|county_|data_center_|zone_layers$)/.test(m)) return { href: "/explorer", label: "Explorer" };
  if (m === "insights") return { href: "/insights", label: "Insights" };
  return null;
}
