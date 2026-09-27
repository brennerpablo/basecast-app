import type { AccountSummary } from "@/lib/accounts/labels";
import type { components } from "@/lib/api/get-data";
import type { CountyRow } from "@/lib/explorer/layers";

type PeakForecastData = components["schemas"]["PeakForecastData"];
type PeakBacktestData = components["schemas"]["PeakBacktestData"];
type SourceComparison = components["schemas"]["SourceComparison"];
type Insight = components["schemas"]["InsightCard"];

/**
 * The picks of the home screen, one per module, from the same responses the module screens read. Pure: each
 * takes the API's data and chooses by a stated rule, never by a hard-coded name or number.
 */

/** The lead finding: the API's first grade A card, else its first card. */
export function leadInsight(cards: Insight[]): Insight | undefined {
  return cards.find((card) => card.grade === "A") ?? cards[0];
}

/** The accounts to call first: `call_now`, in the API's rank. */
export function callFirst(items: AccountSummary[], n: number): AccountSummary[] {
  return items
    .filter((item) => item.next_action === "call_now")
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n);
}

/** The next actions to lapse on or after `asOf` (the data date, not the clock), soonest first, then by rank. */
export function nextLapses(items: AccountSummary[], asOf: string | null | undefined, n: number): AccountSummary[] {
  return items
    .filter((item): item is AccountSummary & { action_changes_on: string } =>
      Boolean(item.action_changes_on && (!asOf || item.action_changes_on >= asOf)),
    )
    .sort((a, b) => a.action_changes_on.localeCompare(b.action_changes_on) || a.rank - b.rank)
    .slice(0, n);
}

/** The top counties by acquisition priority, as the Explorer ranks them on the "all" list. */
export function topCounties(rows: CountyRow[], n: number): (CountyRow & { acquisition: NonNullable<CountyRow["acquisition"]> })[] {
  return rows
    .filter((row): row is CountyRow & { acquisition: NonNullable<CountyRow["acquisition"]> } => row.in_ercot && Boolean(row.acquisition))
    .sort((a, b) => a.acquisition.rank - b.acquisition.rank)
    .slice(0, n);
}

/**
 * The first forecast summer against ERCOT's adjusted line for that year (the line the Forecast screen's stat
 * cards quote), with the gap in MW. `null` when the forecast has no year.
 */
export function nextSummer(data: PeakForecastData) {
  const point = [...data.series].sort((a, b) => a.target_year - b.target_year)[0];
  if (!point) return null;
  const official = data.official.find((line) => line.target_year === point.target_year && line.series === "ercot_adjusted") ?? null;
  return { point, official, gapMw: official ? point.p50_mw - official.mw : null };
}

/**
 * Our P50 and band by year beside ERCOT's adjusted line, for the home screen's small chart. The band is
 * an array (`[p10, p90]`) so one recharts `Area` draws it; it is left out where the API sends no band.
 */
export function peakRows(data: PeakForecastData) {
  const official = new Map(data.official.filter((line) => line.series === "ercot_adjusted").map((line) => [line.target_year, line.mw]));
  return [...data.series]
    .sort((a, b) => a.target_year - b.target_year)
    .map((point) => ({
      year: point.target_year,
      p50: point.p50_mw,
      band: point.p10_mw != null && point.p90_mw != null ? ([point.p10_mw, point.p90_mw] as [number, number]) : undefined,
      official: official.get(point.target_year),
    }));
}

/**
 * The backtest's paired comparisons, era by era in the API's order of eras, and the headline: in the latest
 * era, the official source scored on the most dates. Each comparison pairs our MAPE and the official one on
 * the same dates.
 */
export function backtestEdge(data: PeakBacktestData): { headline: SourceComparison | null; rows: SourceComparison[] } {
  const eraOrder = data.eras.map((era) => era.era);
  const rows = data.comparisons
    .filter((row) => eraOrder.includes(row.era))
    .sort((a, b) => eraOrder.indexOf(a.era) - eraOrder.indexOf(b.era) || b.n - a.n || a.official_source.localeCompare(b.official_source));
  const latest = eraOrder.at(-1);
  const headline = rows.filter((row) => row.era === latest).sort((a, b) => b.n - a.n)[0] ?? null;
  return { headline, rows };
}
