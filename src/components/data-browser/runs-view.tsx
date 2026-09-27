"use client";

import { HistoryIcon } from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";

import { ViewSwitchControl } from "@/components/components-app/ui/view-switch-control";
import EmptyState from "@/components/empty-state";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { Skeleton } from "@/components/ui/skeleton";

import { useLakeSources, useRuns } from "./api";
import { RunDot } from "./file-kind";
import { formatBytes, formatCount, formatDateTime } from "./format";
import { lakeHref, sourceKey } from "./lake-path";

const STATUSES = ["all", "success", "running", "partial", "failed", "abandoned"] as const;

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** /data/runs: the pipeline's run history (`etl_run`), newest first. */
export function RunsView() {
  const [source, setSource] = useQueryState("source", parseAsString);
  const [status, setStatus] = useQueryState("status", parseAsString.withDefault("all"));
  const runs = useRuns(source);
  const sources = useLakeSources();
  const items = (runs.data?.items ?? []).filter((r) => status === "all" || r.status === status);
  const count = (s: string) => (runs.data?.items ?? []).filter((r) => s === "all" || r.status === s).length;
  const inLake = new Set((sources.data?.items ?? []).map((s) => s.source_id));

  return (
    <div className="space-y-4">
      <PageBreadcrumb items={[{ label: "Data", href: "/data" }, { label: "Pipeline runs" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Pipeline runs</h2>
        <select
          value={source ?? ""}
          onChange={(e) => void setSource(e.target.value || null)}
          aria-label="Filter by source"
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="">All sources</option>
          {(sources.data?.items ?? []).map((s) => (
            <option key={s.source_id} value={s.source_id}>
              {s.source_id}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto rounded-lg border bg-card px-3 py-2">
        <ViewSwitchControl
          size="sm"
          value={status}
          onValueChange={(v) => void setStatus(v === "all" ? null : v)}
          ariaLabel="Filter by status"
          options={STATUSES.map((s) => ({ value: s, label: `${s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)} ${count(s)}` }))}
        />
      </div>
      {runs.isPending ? (
        <Skeleton className="h-96 w-full" />
      ) : runs.isError ? (
        <EmptyState Icon={HistoryIcon} title="The run history could not be read" description={runs.error.message} />
      ) : items.length === 0 ? (
        <EmptyState Icon={HistoryIcon} title="No run matches these filters" compact />
      ) : (
        <div className="grid-scrollbar overflow-x-auto rounded-lg border">
          <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 text-right font-medium">Duration</th>
                <th className="px-3 py-2 text-right font-medium">Files</th>
                <th className="px-3 py-2 text-right font-medium">Rows</th>
                <th className="px-3 py-2 text-right font-medium">Bytes</th>
                <th className="px-3 py-2 font-medium">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((r) => (
                <tr key={r.run_id} className="hover:bg-accent/60">
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-xs">
                      <RunDot status={r.status} />
                      {r.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {inLake.has(r.source) ? (
                      <Link href={lakeHref(sourceKey(r.source))} className="hover:text-basecast-brand hover:underline">
                        {r.source}
                      </Link>
                    ) : (
                      r.source
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.stage}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(r.started_at)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums">{formatDuration(r.duration_s)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {formatCount(r.files)}
                    {r.files_skipped ? <span className="text-xs text-muted-foreground"> (+{formatCount(r.files_skipped)} skipped)</span> : null}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCount(r.rows)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatBytes(r.bytes)}</td>
                  <td className="max-w-80 truncate px-3 py-2 text-xs text-destructive" title={r.error ?? undefined}>
                    {r.error ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
