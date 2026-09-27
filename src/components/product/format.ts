/**
 * Numbers and dates on the product screens: MW with a thousands separator below 10 GW, GW with one decimal
 * from there, percents with one decimal, dates in America/Chicago. A missing value is `GAP`, never a zero.
 */

export const GAP = "—";

const WHOLE = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ONE = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const SIGNED_ONE = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});
const PLAIN = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

const missing = (value: number | null | undefined): value is null | undefined =>
  value === null || value === undefined || !Number.isFinite(value);

/** `8,850 MW` below 10 GW, `91.1 GW` from there. */
export function formatPower(mw: number | null | undefined): string {
  if (missing(mw)) return GAP;
  const rounded = Math.round(mw) || 0;
  return Math.abs(rounded) < 10_000 ? `${WHOLE.format(rounded)} MW` : `${ONE.format(mw / 1_000)} GW`;
}

/** `3.8%`. `ratio` reads 0.038 as the same; `signed` writes the sign of an error (`+9.3%`, `-13.2%`). */
export function formatPercent(
  value: number | null | undefined,
  { ratio = false, signed = false }: { ratio?: boolean; signed?: boolean } = {},
): string {
  if (missing(value)) return GAP;
  return `${(signed ? SIGNED_ONE : ONE).format(ratio ? value * 100 : value)}%`;
}

/** `20,219`: a count, rounded to the unit. */
export function formatWhole(value: number | null | undefined): string {
  return missing(value) ? GAP : WHOLE.format(Math.round(value) || 0);
}

/** `1,234` or `0.72`: at most two decimals. */
export function formatNumber(value: number | null | undefined): string {
  return missing(value) ? GAP : PLAIN.format(value);
}

const DAY_UTC = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" });
const MONTH_UTC = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" });
const DAY_CT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Chicago",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/**
 * `Jul 22, 2026`. A calendar date (`2026-07-22`) or month (`2026-07` → `Jul 2026`) shows as written, never
 * shifted by a time zone; a timestamp shows its day in America/Chicago.
 */
export function formatDate(value: string | null | undefined): string {
  if (!value) return GAP;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return DAY_UTC.format(new Date(`${value}T00:00:00Z`));
  if (/^\d{4}-\d{2}$/.test(value)) return MONTH_UTC.format(new Date(`${value}-01T00:00:00Z`));
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DAY_CT.format(date);
}

/** `16:59` for a local hour given as a decimal (16.98). */
export function formatHour(value: number | null | undefined): string {
  if (missing(value)) return GAP;
  const minutes = Math.round(value * 60);
  return `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const TWO = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Units that count whole things: shown without decimals. */
const WHOLE_UNITS = new Set(["customers", "meters", "homes", "people", "MWh", "projects"]);
/** Apportioned counts (a share of a county's permits): one decimal. */
const TENTHS_UNITS = new Set(["units"]);

/**
 * A Fact's value by the unit get-data sends: power and percents by the rules above, `share` as a percent,
 * `per year` as a signed yearly rate, prices in ¢/kWh, `thousand USD` in dollars, `hour` as a clock time,
 * counts whole, anything else with two decimals at most and its unit.
 */
export function formatValue(value: number | string | boolean | null | undefined, unit?: string | null): string {
  if (value === null || value === undefined) return GAP;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return unit ? `${value} ${unit}` : value;
  if (!Number.isFinite(value)) return GAP;
  switch (unit) {
    case "MW":
      return formatPower(value);
    case "GW":
      return formatPower(value * 1_000);
    case "%":
      return formatPercent(value);
    case "share":
      return formatPercent(value, { ratio: true });
    case "per year":
      return `${formatPercent(value, { ratio: true, signed: true })}/yr`;
    case "USD/kWh":
      return `${TWO.format(value * 100)} ¢/kWh`;
    case "thousand USD":
      return USD_COMPACT.format(value * 1_000);
    case "hour":
      return formatHour(value);
    case "ratio":
      return TWO.format(value);
    case null:
    case undefined:
    case "":
      return formatNumber(value);
    default:
      if (WHOLE_UNITS.has(unit)) return `${formatWhole(value)} ${unit}`;
      if (TENTHS_UNITS.has(unit)) return `${ONE.format(value)} ${unit}`;
      return `${formatNumber(value)} ${unit}`;
  }
}
