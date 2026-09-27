import type { NextAction } from "@/lib/accounts/labels";
import type { Fact } from "@/lib/bff/envelope";

/** The order next actions sort and list in, most urgent first. */
export const ACTION_ORDER: NextAction[] = ["call_now", "nurture", "watch", "hold"];

/** How many accounts carry each next action, every action present (a zero when none does). */
export function countByAction(items: { next_action: NextAction }[]): Record<NextAction, number> {
  const counts = Object.fromEntries(ACTION_ORDER.map((action) => [action, 0])) as Record<NextAction, number>;
  for (const item of items) counts[item.next_action] = (counts[item.next_action] ?? 0) + 1;
  return counts;
}

/** Header facts the account's title already shows. */
const IN_TITLE = new Set(["name", "account_type"]);

/** Header facts that make the KPI strip: the account's size, sales and prices. */
export const KPI_FACT_KEYS = [
  "territory_km2",
  "customers",
  "customer_cagr",
  "sales_mwh",
  "revenue_kusd",
  "price",
  "price_cagr",
  "res_price",
] as const;
const KPI_KEYS = new Set<string>(KPI_FACT_KEYS);

/**
 * The account's header facts split for the page: the KPI strip and the profile card, each in the API's
 * order. Nothing is dropped: a key the app does not know goes to the profile.
 */
export function splitHeaderFacts(facts: Fact[]): { kpis: Fact[]; profile: Fact[] } {
  const kpis: Fact[] = [];
  const profile: Fact[] = [];
  for (const fact of facts) {
    if (IN_TITLE.has(fact.key)) continue;
    (KPI_KEYS.has(fact.key) ? kpis : profile).push(fact);
  }
  return { kpis, profile };
}

/** A header fact's value as plain text, for the title's grey line; null when absent or empty. */
export function headerText(facts: Fact[], key: string): string | null {
  const value = facts.find((fact) => fact.key === key)?.value;
  return typeof value === "string" && value.trim() ? value : null;
}

/** The territory's facts by theme, for its tab. */
export type TerritoryFactGroups = { growth: Fact[]; dataCenters: Fact[]; queue: Fact[]; zone: Fact[]; other: Fact[] };

const GROWTH_KEYS = new Set([
  "population",
  "pop_growth",
  "permits_per_1k",
  "permits_12m",
  "permits_12m_change",
  "owner_sf_homes",
  "owner_sf_share",
  "homes_per_meter",
]);

/**
 * The territory facts split by theme, each in the API's order: growth and homes, data centers (`dc_`), the
 * generation queue (`queue_`, `storage_`) and the weather zone (`weather_zone`, `zone_`). A key the app does
 * not know goes to `other`, so nothing is dropped.
 */
export function groupTerritoryFacts(facts: Fact[]): TerritoryFactGroups {
  const groups: TerritoryFactGroups = { growth: [], dataCenters: [], queue: [], zone: [], other: [] };
  for (const fact of facts) {
    const key = fact.key;
    if (GROWTH_KEYS.has(key)) groups.growth.push(fact);
    else if (key.startsWith("dc_")) groups.dataCenters.push(fact);
    else if (key.startsWith("queue_") || key.startsWith("storage_")) groups.queue.push(fact);
    else if (key === "weather_zone" || key.startsWith("zone_")) groups.zone.push(fact);
    else groups.other.push(fact);
  }
  return groups;
}

/**
 * The talking points of the pitch without the zone's 4CP line, which has its one home on the Wholesale & 4CP tab.
 * The API appends that line last; it matches the 4CP offer's `zone_line`, or the zone outlook's `line` (the same
 * sentence, sometimes with a trailing clause the offer drops). Without a `zone_line` the points stay as they are,
 * since the 4CP tab would not show the line.
 */
export function pitchPoints(points: string[], zoneLine: string | null | undefined, outlookLine?: string | null): string[] {
  if (!zoneLine) return points;
  return points.filter((point) => !point.startsWith(zoneLine) && point !== outlookLine);
}

/** A trailing "(source)" that names an internal table or adapter: `(queue_adjusted)`, `(UtilityDataSource)`. */
const INTERNAL_SOURCE = /\s*\((?:[A-Za-z]+DataSource|[a-z0-9]+(?:_[a-z0-9]+)+)\)\s*$/;

/** A data gap's text without the internal source the API appends to it. */
export function gapText(detail: string): string {
  return detail.replace(INTERNAL_SOURCE, "");
}

/** A config file path inside the API's prose, e.g. "(config/account_score.yaml, pending review)". */
const CONFIG_PARENTHETICAL = /\s*\([^)]*\b[\w-]+\/[\w./-]+\.(?:ya?ml|json|toml|py)\b[^)]*\)/g;

/** The score's method as a sentence for a tooltip: capitalized, without the config file it cites. */
export function methodText(method: string): string {
  const text = method.replace(CONFIG_PARENTHETICAL, "").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * A label and its explanation, split at the first parenthetical: "3 exposed counties (share ≥ 20%)" gives
 * "3 exposed counties" to show and "3 exposed counties (share ≥ 20%)" for the tooltip. A label without one has no
 * detail.
 */
export function splitLabel(label: string): { short: string; detail: string | null } {
  const at = label.indexOf(" (");
  if (at <= 0) return { short: label.charAt(0).toUpperCase() + label.slice(1), detail: null };
  const short = label.slice(0, at);
  return { short: short.charAt(0).toUpperCase() + short.slice(1), detail: label.charAt(0).toUpperCase() + label.slice(1) };
}
