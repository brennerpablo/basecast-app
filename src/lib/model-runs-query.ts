"use client";

import { useQuery } from "@tanstack/react-query";

import { useProductQuery } from "@/lib/bff/queries";
import { dataUrl } from "@/lib/bff/url";

import { MODEL_RUN_FILTERS, type ModelRun, parseRuns, type RowsPage, type RunLogPage } from "./model-runs";

/** The newest model runs (mart builds), read from `etl_run` through get-data with their events and params. */
export function useModelRuns(limit = 50) {
  const query = useProductQuery<RowsPage>(
    "tables/etl_run/rows",
    { filter: MODEL_RUN_FILTERS, sort: "started_at", desc: true, limit },
    { throwOnError: false },
  );
  return { ...query, runs: query.data ? parseRuns(query.data.data) : undefined };
}

/** One model run by its `run_id`; `run` is null when no model run has that id. */
export function useModelRun(runId: string) {
  const query = useProductQuery<RowsPage>(
    "tables/etl_run/rows",
    { filter: [...MODEL_RUN_FILTERS, `run_id:eq:${runId}`], limit: 1 },
    { throwOnError: false },
  );
  const run: ModelRun | null | undefined = query.data ? (parseRuns(query.data.data)[0] ?? null) : undefined;
  return { ...query, run };
}

/** A run's `ops.log` lines, as recorded in the snapshot. */
export function useRunLogs(runId: string) {
  return useQuery({
    queryKey: ["ops", "logs", "run", runId],
    queryFn: async ({ signal }) => {
      const response = await fetch(dataUrl(`ops-log/runs/${encodeURIComponent(runId)}`), { signal });
      if (!response.ok) throw new Error(`The run's log could not be read (${response.status})`);
      return (await response.json()) as RunLogPage;
    },
  });
}
