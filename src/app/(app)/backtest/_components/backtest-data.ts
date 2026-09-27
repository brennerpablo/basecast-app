/**
 * The /backtest screen's reading of get-data's backtest resources: types, labels and the pure helpers the
 * cards share (axis scales, groupings, the error bins of the vintage matrix). Every number shown comes from
 * the API; the only constants here are presentation (tick steps, color bins).
 */

import type { components } from "@/lib/api/get-data";

type Schemas = components["schemas"];

export type PeakData = Schemas["PeakBacktestData"];
export type Cell = Schemas["BacktestCell"];
export type FanPoint = Schemas["FanPoint"];
export type Score = Schemas["BacktestScore"];
export type Comparison = Schemas["SourceComparison"];
export type Era = Schemas["Era"];
export type ActualPeak = Schemas["ActualPeak"];
export type OfficialErrorsData = Schemas["OfficialErrorsData"];
export type OfficialError = Schemas["OfficialError"];
export type HorizonSummary = Schemas["HorizonSummary"];
export type QueueData = Schemas["QueueBacktestData"];
export type QueueRow = Schemas["QueueBacktestRow"];
export type CountyRank = Schemas["CountyRankCheck"];

/** Our model and its ablation, as `source` in cells and scores. */
export const MODEL = "basecast";
export const ORGANIC = "basecast_organic_only";

/** The color family of a source or product: a hyphenated edition (`LTLF-prelim`) belongs to its product. */
export type Family = "basecast" | "organic" | "LTLF" | "CDR" | "other";

export function family(code: string | null | undefined): Family {
  if (!code) return "other";
  if (code === MODEL) return "basecast";
  if (code === ORGANIC) return "organic";
  if (code === "LTLF" || code.startsWith("LTLF-")) return "LTLF";
  if (code === "CDR" || code.startsWith("CDR-")) return "CDR";
  return "other";
}

/** A source code as the screen names it. */
export function sourceLabel(source: string): string {
  if (source === MODEL) return "basecast";
  if (source === ORGANIC) return "basecast, organic only";
  if (source === "LTLF-prelim") return "Preliminary LTLF";
  return source;
}

/** What an official product is, for tooltips and legends. */
export const PRODUCT_NAME: Record<string, string> = {
  LTLF: "ERCOT's long-term load forecast",
  CDR: "ERCOT's report on capacity, demand and reserves",
  "LTLF-prelim": "ERCOT's preliminary long-term load forecast",
};

export const isOfficial = (source: string) => source !== MODEL && source !== ORGANIC;

/** An era's label from `data.eras`; `all` is every backtest date. */
export function eraLabel(era: string, eras: Era[]): string {
  if (era === "all") return "All dates";
  return eras.find((e) => e.era === era)?.label ?? era;
}

/** Eras in the API's order, then `all`. */
export function eraOrder(eras: Era[]): string[] {
  return [...eras.map((e) => e.era), "all"];
}

/** Milliseconds of a calendar date (`2026-05-31`), at UTC midnight. */
export const dayMs = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** A calendar-friendly step for about `target` intervals over `range`: 1, 2, 2.5 or 5 × 10^n. */
export function niceStep(range: number, target = 5): number {
  if (!(range > 0)) return 1;
  const raw = range / target;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const n = raw / magnitude;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * magnitude;
}

/** A padded domain snapped to a nice step, and its ticks. */
export function niceScale(values: number[], target = 5): { domain: [number, number]; ticks: number[] } {
  const present = values.filter((v) => Number.isFinite(v));
  if (!present.length) return { domain: [0, 1], ticks: [0, 1] };
  let low = Math.min(...present);
  let high = Math.max(...present);
  if (low === high) {
    low -= Math.abs(low) * 0.05 || 1;
    high += Math.abs(high) * 0.05 || 1;
  }
  const step = niceStep(high - low, target);
  const start = Math.floor(low / step) * step;
  const end = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= end + step / 1e6; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { domain: [start, end], ticks };
}

/** January 1 of every `every`-th year between two instants, in ms. */
export function yearTicks(fromMs: number, toMs: number, every = 1): number[] {
  const ticks: number[] = [];
  const first = new Date(fromMs).getUTCFullYear() + 1;
  const last = new Date(toMs).getUTCFullYear();
  for (let year = first; year <= last; year += 1) {
    if ((year - first) % every === 0) ticks.push(Date.UTC(year, 0, 1));
  }
  return ticks;
}

/** An axis tick in GW: `80 GW`, `82.5 GW`. */
export function gwTick(mw: number): string {
  const gw = mw / 1_000;
  return `${Number.isInteger(gw) ? gw : gw.toFixed(1)} GW`;
}

/** (forecast − actual) ÷ actual, in %: the contract's error, for marks that carry no `error_pct`. */
export function errorPct(forecast: number | null | undefined, actual: number | null | undefined): number | null {
  if (forecast == null || actual == null || !actual) return null;
  return ((forecast - actual) / actual) * 100;
}

// ── The fan (the latest summer's forecasts) ────────────────────────────────────────────────────────────

export type FanParts = {
  actual: FanPoint | undefined;
  preliminary: FanPoint | undefined;
  range: FanPoint | undefined;
  officials: FanPoint[];
  models: FanPoint[];
};

export function fanParts(fan: FanPoint[]): FanParts {
  const byDate = (a: FanPoint, b: FanPoint) => (a.vintage_date ?? "").localeCompare(b.vintage_date ?? "");
  return {
    actual: fan.find((p) => p.kind === "actual"),
    preliminary: fan.find((p) => p.kind === "official_preliminary"),
    range: fan.find((p) => p.kind === "official_range"),
    officials: fan.filter((p) => p.kind === "official").sort(byDate),
    models: fan.filter((p) => p.kind === "model").sort(byDate),
  };
}

/** The model point of the fan made at an as-of date. */
export const modelAt = (models: FanPoint[], asOf: string | null | undefined) =>
  models.find((p) => (p.vintage_date ?? p.vintage) === asOf);

/**
 * The fan's official points that the selected date's cells used for the fan's target year: same vintage
 * and the same value (one vintage can print two series, e.g. LTLF 2025 ERCOT-adjusted and TSP-provided).
 */
export function officialsInUse(points: FanPoint[], cells: Cell[], targetYear: number): Set<FanPoint> {
  const used = cells.filter((c) => c.target_year === targetYear && isOfficial(c.source) && c.vintage);
  return new Set(
    points.filter((p) =>
      used.some((c) => c.vintage === p.vintage && p.value_mw != null && Math.abs(c.p50_mw - p.value_mw) < 1),
    ),
  );
}

// ── The cells of one as-of date ──────────────────────────────────────────────────────────────────────

export type TargetGroup = {
  targetYear: number;
  horizon: number;
  actualMw: number | null;
  actualFinal: boolean;
  model: Cell | undefined;
  organic: Cell | undefined;
  officials: Cell[];
};

/** The selected date's cells by target year: the model, its ablation and the official vintages in use. */
export function groupByTarget(cells: Cell[]): TargetGroup[] {
  const years = [...new Set(cells.map((c) => c.target_year))].sort((a, b) => a - b);
  return years.map((targetYear) => {
    const rows = cells.filter((c) => c.target_year === targetYear);
    const withActual = rows.find((c) => c.actual_mw != null);
    return {
      targetYear,
      horizon: rows[0].horizon,
      actualMw: withActual?.actual_mw ?? null,
      actualFinal: rows.every((c) => c.actual_final !== false),
      model: rows.find((c) => c.source === MODEL),
      organic: rows.find((c) => c.source === ORGANIC),
      officials: rows
        .filter((c) => isOfficial(c.source))
        .sort((a, b) => (a.vintage_date ?? "").localeCompare(b.vintage_date ?? "") || a.source.localeCompare(b.source)),
    };
  });
}

/** Table order inside a target year: the model, its ablation, then the official vintages. */
export function orderCells(group: TargetGroup): Cell[] {
  return [group.model, group.organic, ...group.officials].filter((c): c is Cell => c !== undefined);
}

// ── Scores ───────────────────────────────────────────────────────────────────────────────────────────

/** Comparisons by official source, each source's eras in the API's era order (`all` last). */
export function comparisonsBySource(comparisons: Comparison[], eras: Era[]): [string, Comparison[]][] {
  const order = eraOrder(eras);
  const rank = (era: string) => (order.indexOf(era) === -1 ? order.length : order.indexOf(era));
  const sources = [...new Set(comparisons.map((c) => c.official_source))];
  return sources.map((source) => [
    source,
    comparisons.filter((c) => c.official_source === source).sort((a, b) => rank(a.era) - rank(b.era)),
  ]);
}

/** Scores by era (API order, `all` last), each era's sources with ours first. */
export function scoresByEra(scores: Score[], eras: Era[]): [string, Score[]][] {
  const order = eraOrder(eras);
  const present = [...new Set(scores.map((s) => s.era))].sort(
    (a, b) => (order.indexOf(a) + 1 || order.length + 1) - (order.indexOf(b) + 1 || order.length + 1),
  );
  const sourceRank = (s: string) => (s === MODEL ? 0 : s === ORGANIC ? 1 : 2);
  return present.map((era) => [
    era,
    scores
      .filter((s) => s.era === era)
      .sort((a, b) => sourceRank(a.source) - sourceRank(b.source) || a.source.localeCompare(b.source)),
  ]);
}

// ── The official vintages' error matrix ──────────────────────────────────────────────────────────────

/** The products offered as views: a hyphenated edition (`LTLF-prelim`) shows inside its product's view. */
export function productViews(products: string[]): string[] {
  return products.filter((p) => !products.some((other) => other !== p && p.startsWith(`${other}-`)));
}

export const inView = (product: string, view: string) => product === view || product.startsWith(`${view}-`);

export type MatrixRow = { product: string; vintage: string; vintageDate: string | null; byYear: Map<number, OfficialError> };

/** Vintage × target year for one view, vintages by publication date. */
export function errorMatrix(items: OfficialError[], view: string): { rows: MatrixRow[]; years: number[] } {
  const shown = items.filter((i) => inView(i.product, view));
  const years = [...new Set(shown.map((i) => i.target_year))].sort((a, b) => a - b);
  const rows = new Map<string, MatrixRow>();
  for (const item of shown) {
    const key = `${item.product}|${item.vintage}`;
    let row = rows.get(key);
    if (!row) {
      row = { product: item.product, vintage: item.vintage, vintageDate: item.vintage_date ?? null, byYear: new Map() };
      rows.set(key, row);
    }
    row.byYear.set(item.target_year, item);
  }
  const sorted = [...rows.values()].sort(
    (a, b) => (a.vintageDate ?? "").localeCompare(b.vintageDate ?? "") || a.vintage.localeCompare(b.vintage),
  );
  return { rows: sorted, years };
}

/** Bin edges of |error| in %, for the matrix colors: within the first is the neutral midpoint. */
export const ERROR_BINS = [2, 5, 10] as const;

/** A signed bin: 0 is within ±2%, ±1..±3 outward; negative = under-forecast, positive = over-forecast. */
export function errorBin(pct: number | null | undefined): number | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const size = Math.abs(pct);
  const step = size < ERROR_BINS[0] ? 0 : size < ERROR_BINS[1] ? 1 : size < ERROR_BINS[2] ? 2 : 3;
  return pct < 0 ? -step : step;
}

// ── The generation queue backtest ────────────────────────────────────────────────────────────────────

export const STRATUM_LABEL: Record<string, string> = {
  all: "All",
  solar: "Solar",
  storage: "Storage",
  wind: "Wind",
  gas_other: "Gas and other",
};

export const stratumLabel = (code: string) => STRATUM_LABEL[code] ?? code.replaceAll("_", " ");

/** Report months in order, and the strata in the API's order with `all` first. */
export function queueLayout(items: QueueRow[]): { months: string[]; strata: string[] } {
  const months = [...new Set(items.map((i) => i.report_month))].sort();
  const seen = [...new Set(items.map((i) => i.stratum))];
  const strata = [...seen.filter((s) => s === "all"), ...seen.filter((s) => s !== "all")];
  return { months, strata };
}
