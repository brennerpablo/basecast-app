"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { type Caveat, fetchEnvelope, isMartNotBuilt } from "./envelope";
import type { Params } from "./url";

/** Retry what can pass on a second try: not a 4xx, and not a mart that is not built yet. */
function retry(count: number, error: unknown): boolean {
  if (isMartNotBuilt(error)) return false;
  const status = (error as { status?: unknown } | null)?.status;
  return (typeof status !== "number" || status >= 500) && count < 2;
}

export const productKeys = {
  all: ["product"] as const,
  resource: (path: string, params?: Params) => ["product", path, params ?? {}] as const,
  caveats: () => ["product", "caveats"] as const,
};

/**
 * A product resource (`data` + `meta`) through the BFF. A missing mart (503 `mart_not_built`) stays in
 * the query for `<DataCard>` to show as an empty state; any other failure with nothing on screen yet
 * goes to the route's `error.tsx`. `keepPrevious` holds the last answer on screen while new filters load.
 */
export function useProductQuery<T>(
  path: string,
  params?: Params,
  { enabled = true, keepPrevious = false }: { enabled?: boolean; keepPrevious?: boolean } = {},
) {
  return useQuery({
    queryKey: productKeys.resource(path, params),
    queryFn: ({ signal }) => fetchEnvelope<T>(path, params, signal),
    enabled,
    retry,
    throwOnError: (error, query) => !isMartNotBuilt(error) && query.state.data === undefined,
    placeholderData: keepPrevious ? keepPreviousData : undefined,
  });
}

/** The caveat catalog (`GET /caveats`), by code. It only changes with the contract. */
export function useCaveatCatalog() {
  return useQuery({
    queryKey: productKeys.caveats(),
    queryFn: ({ signal }) => fetchEnvelope<{ items: Caveat[] }>("caveats", undefined, signal),
    select: (envelope) => new Map(envelope.data.items.map((caveat) => [caveat.code, caveat])),
    staleTime: Infinity,
    retry,
  });
}
