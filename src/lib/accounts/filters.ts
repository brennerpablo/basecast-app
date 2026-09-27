import { parseAsNativeArrayOf, parseAsString, parseAsStringLiteral } from "nuqs";

import type { Params } from "@/lib/bff/url";

/**
 * The /accounts filters, as they live in the URL: repeated keys for the lists (`?tier=A&tier=B`, as
 * get-data takes them, and safe for G&T names with commas), `county` from the Explorer, `rank` for the
 * "rank within type" toggle.
 */
export const accountsFilterParsers = {
  type: parseAsNativeArrayOf(parseAsString),
  tier: parseAsNativeArrayOf(parseAsString),
  action: parseAsNativeArrayOf(parseAsString),
  trigger: parseAsNativeArrayOf(parseAsString),
  zone: parseAsNativeArrayOf(parseAsString),
  gt: parseAsNativeArrayOf(parseAsString),
  q: parseAsString.withDefault(""),
  county: parseAsString,
  rank: parseAsStringLiteral(["all", "within_type"] as const).withDefault("all"),
};

export type AccountsFilters = {
  type: string[];
  tier: string[];
  action: string[];
  trigger: string[];
  zone: string[];
  gt: string[];
  q: string;
  county: string | null;
  rank: "all" | "within_type";
};

/** The list filters, in the order the toolbar shows them. */
export const LIST_FILTERS = ["type", "tier", "action", "trigger", "zone", "gt"] as const;
export type ListFilter = (typeof LIST_FILTERS)[number];

/** get-data's name for each list filter. */
const API_NAME: Record<ListFilter, string> = {
  type: "type",
  tier: "tier",
  action: "next_action",
  trigger: "trigger",
  zone: "zone",
  gt: "gt",
};

/**
 * The `GET /accounts` params of the filters, for the list and its CSV export alike. Empty filters are left
 * out, so no filter at all asks for the same resource as the unfiltered list (one cache entry).
 */
export function accountsApiParams(filters: AccountsFilters): Params {
  const params: Params = {};
  for (const name of LIST_FILTERS) if (filters[name].length) params[API_NAME[name]] = filters[name];
  if (filters.q.trim()) params.q = filters.q.trim();
  if (filters.county) params.county = filters.county;
  if (filters.rank === "within_type") params.rank_scope = "within_type";
  return params;
}

/** True when any filter narrows the list (the rank toggle only reorders it). */
export function hasActiveFilters(filters: AccountsFilters): boolean {
  return LIST_FILTERS.some((name) => filters[name].length > 0) || Boolean(filters.q.trim()) || Boolean(filters.county);
}
