/**
 * Where each recorded response lives under `snapshot/`, shared by the recorder
 * (`scripts/snapshot/record.ts`) and the reader (`src/lib/snapshot/`). Every file is gzipped JSON except
 * `manifest.json`.
 */

export const MANIFEST = "manifest.json";

/** Rows kept per table; the tables in `WHOLE_TABLES` are kept whole (the model runs read `etl_run`). */
export const TABLE_SAMPLE = 500;
export const WHOLE_TABLES = new Set(["etl_run"]);

/** Responses recorded once, read whatever the query (the screens send none). */
export const SINGLES = [
  "caveats",
  "glossary",
  "insights",
  "four-cp",
  "forecasts/large-load",
  "forecasts/queue-curves",
  "backtest/official-errors",
  "backtest/queue",
  "geo/zones",
  "tables",
  "lake/sources",
] as const;

export type Single = (typeof SINGLES)[number];

const gz = (path: string) => `${path}.json.gz`;

export const files = {
  single: (path: Single) => gz(path),
  peak: (variant: string, region: string) => gz(`forecasts/peak/${variant}/${region}`),
  normalized: (region: string) => gz(`load/normalized/${region}`),
  backtestPeak: (asOf: string) => gz(`backtest/peak/${asOf}`),
  countiesLayer: (horizon: number, stratum: string) => gz(`geo/counties/layer/${horizon}-${stratum}`),
  county: (fips: string) => gz(`geo/counties/detail/${fips}`),
  accounts: gz("accounts/list"),
  accountsCsv: "accounts/export.csv.gz",
  /** `{ [county_fips]: account_id[] }`: the accounts that cover at least 1% of each county. */
  accountsByCounty: gz("accounts/by-county"),
  account: (id: string) => gz(`accounts/detail/${id}`),
  /** Every event of the account in one page, newest first. */
  events: (id: string) => gz(`accounts/events/${id}`),
  table: (name: string) => gz(`tables/detail/${name}`),
  /** The first rows of the table (every row of the small ones). */
  tableRows: (name: string) => gz(`tables/rows/${name}`),
  /** Every raw file behind the table, in one page. */
  lineage: (name: string) => gz(`tables/lineage/${name}`),
  /** `{ [prefix]: envelope }`: each folder's listing, whole. */
  lakeListings: gz("lake/listings"),
  /** `{ [key]: { status, body } }`: each file's detail. */
  lakeObjects: gz("lake/objects"),
  /** Every `etl_run` row in one page, newest first. */
  runs: gz("pipeline/runs"),
  /** `{ [run_id]: { entries, levelCounts, nextBefore } }`: the ops.log lines of each model run. */
  runLogs: gz("ops-log/runs"),
  /** Filtered answers of the live API, kept to test the reader's filters against. */
  parity: gz("parity"),
};

export type Manifest = {
  /** When the snapshot was recorded (ISO, UTC). */
  recordedAt: string;
  /** The API it was recorded from. */
  source: string;
  /** What the API answers when a parameter is left out. */
  defaults: {
    peakVariant: string;
    peakRegion: string;
    normalizedRegion: string;
    /** The latest backtest date. */
    backtestAsOf: string;
    countiesHorizon: number;
    countiesStratum: string;
  };
  /** How many rows of each table were kept, against the table's own count. */
  tableRows: Record<string, { kept: number; rows: number | null }>;
  counts: Record<string, number>;
};
