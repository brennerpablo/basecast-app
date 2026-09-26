"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { components } from "@/lib/api/get-data";

import { fetchEnvelope, fetchJson, isMartNotBuilt } from "./envelope";
import type { Params } from "./url";

/** Retry what can pass on a second try: not a 4xx, and not a mart that is not built yet. */
function retry(count: number, error: Error): boolean {
  if (isMartNotBuilt(error)) return false;
  const status = (error as { status?: unknown } | null)?.status;
  return (typeof status !== "number" || status >= 500) && count < 2;
}

export const productKeys = {
  all: ["product"] as const,
  resource: (path: string, params?: Params) => ["product", path, params ?? {}] as const,
  caveats: () => ["product", "caveats"] as const,
  glossary: () => ["product", "glossary"] as const,
};

/**
 * A product resource (`data` + `meta`) through the BFF. A missing mart (503 `mart_not_built`) stays in
 * the query for `<DataCard>` to show as an empty state; any other failure with nothing on screen yet
 * goes to the route's `error.tsx`, unless `throwOnError` is false (a query that only decorates the page).
 * `keepPrevious` holds the last answer on screen while new filters load.
 */
export function useProductQuery<T>(
  path: string,
  params?: Params,
  {
    enabled = true,
    keepPrevious = false,
    throwOnError = true,
  }: { enabled?: boolean; keepPrevious?: boolean; throwOnError?: boolean } = {},
) {
  return useQuery({
    queryKey: productKeys.resource(path, params),
    queryFn: ({ signal }) => fetchEnvelope<T>(path, params, signal),
    enabled,
    retry,
    throwOnError: (error, query) => throwOnError && !isMartNotBuilt(error) && query.state.data === undefined,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}

/** The caveat catalog (`GET /caveats`, not an envelope), by code. It only changes with the contract. */
export function useCaveatCatalog() {
  return useQuery({
    queryKey: productKeys.caveats(),
    queryFn: ({ signal }) => fetchJson<components["schemas"]["CaveatsResponse"]>("caveats", undefined, signal),
    select: (catalog) => new Map(catalog.items.map((caveat) => [caveat.code, caveat])),
    staleTime: Infinity,
    retry,
  });
}

export type GlossaryItem = components["schemas"]["GlossaryItem"];

/** The glossary (`GET /glossary`, not an envelope): label and text of each trigger, flag and next-action code. */
export function useGlossary() {
  return useQuery({
    queryKey: productKeys.glossary(),
    queryFn: ({ signal }) => fetchJson<components["schemas"]["GlossaryResponse"]>("glossary", undefined, signal),
    select: (glossary) => new Map(glossary.items.map((item) => [`${item.kind}:${item.code}`, item])),
    staleTime: Infinity,
    retry,
  });
}
