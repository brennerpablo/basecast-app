"use client";

import { Activity, CircleAlert, CircleCheck, Loader2, TriangleAlert, Workflow } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";

import { AreaChart } from "@/components/components-app/charts/area-chart";
import { type ColumnMetadata, DataTable } from "@/components/components-app/data-table";
import EmptyState from "@/components/empty-state";
import SkeletonDatatable from "@/components/skeleton-datatable";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { bucketStarts } from "@/lib/ops/range";
import type { EtlRunDetail, EtlRunRow, OpsRange, OpsRuns } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { fmtAgo, fmtBucket, fmtDayTime, fmtDuration, fmtInt, fmtLogTime } from "./format";
import {
  ACCENT,
  ChartSkeleton,
  Field,
  FieldBlock,
  KpiCard,
  LevelBadge,
  LoadError,
  RANGE_LABEL,
  RunStatusBadge,
  SectionCard,
  useOpsQuery,
} from "./ops-bits";

/** A run slower than this multiple of its source's 30-day median is flagged. */
const SLOW_RATIO = 2;

type RunEvent = { at?: string; kind?: string; [key: string]: unknown };

/** One run in a side sheet, as the Fundsys pipelines screen shows a task instance. */
function RunDetailSheet({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const { data, isLoading, error } = useOpsQuery<EtlRunDetail>(
    ["run", runId],
    runId ? `/api/ops/runs/${encodeURIComponent(runId)}` : null,
  );
  const run = data?.run;
  const events = (Array.isArray(run?.events) ? run.events : []) as RunEvent[];

  return (
    <Sheet open={!!runId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>
            {run ? (
              <>
                <span className="font-mono">{run.source}</span>
                <span className="ml-2 text-xs text-muted-foreground">{run.stage}</span>
              </>
            ) : (
              <Skeleton className="h-5 w-56" />
            )}
          </SheetTitle>
          <SheetDescription asChild>
            <div>{run ? `${fmtDayTime(run.startedAt)} CT` : <Skeleton className="h-3 w-36" />}</div>
          </SheetDescription>
        </SheetHeader>

        {error && !data ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <CircleAlert className="size-8 text-red-600" />
            <div className="text-sm font-medium text-foreground">Could not load this run</div>
            <div className="max-w-md text-xs text-muted-foreground">{error.message}</div>
          </div>
        ) : isLoading || !run ? (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-32" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-2.5 w-16" />
                <Skeleton className="h-4 w-full max-w-sm" />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <RunStatusBadge status={run.status} />
              <span className="text-xs text-muted-foreground">
                {run.status === "running" ? "Running" : `Took ${fmtDuration((run.durationS ?? 0) * 1_000)}`}
              </span>
              {run.rows !== null && <span className="text-xs text-muted-foreground">{fmtInt(run.rows)} rows</span>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Run ID" value={run.runId} mono />
              <Field label="DAG" value={run.dagId ?? "—"} mono />
              <Field label="Try" value={run.tryNumber ?? "—"} />
              <Field label="Files" value={run.files === null ? "—" : fmtInt(run.files)} />
            </div>

            {run.error && (
              <FieldBlock label="Error" tone="error">
                <pre className="overflow-x-auto rounded-md border border-red-200 bg-red-50 p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {run.error}
                </pre>
              </FieldBlock>
            )}

            <FieldBlock label={`Events (${fmtInt(events.length)})`}>
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground">No events recorded.</p>
              ) : (
                <ol className="space-y-1">
                  {events.slice(0, 200).map((e, i) => {
                    const { at, kind, ...rest } = e;
                    return (
                      <li key={i} className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{at ? fmtLogTime(at) : "—"}</span>
                        <span className={cn("shrink-0 font-mono text-[10px] font-semibold uppercase", kind === "error" ? "text-red-600" : "text-basecast-brand")}>
                          {String(kind ?? "?")}
                        </span>
                        <span className="font-mono text-xs wrap-break-word">{JSON.stringify(rest)}</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </FieldBlock>

            <FieldBlock label={`Log lines (${fmtInt(data.logs.length)})`}>
              {data.logs.length === 0 ? (
                <p className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground italic">
                  This run wrote no lines to ops.log.
                </p>
              ) : (
                <ol className="space-y-1">
                  {data.logs.map((l) => (
                    <li key={l.id} className="flex items-start gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{fmtLogTime(l.ts)}</span>
                      <LevelBadge level={l.level} />
                      <span className="text-xs wrap-break-word">{l.message}</span>
                    </li>
                  ))}
                </ol>
              )}
            </FieldBlock>

            {run.params != null && (
              <FieldBlock label="Params">
                <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
                  {JSON.stringify(run.params, null, 2)}
                </pre>
              </FieldBlock>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function PipelinesTab({ range }: { range: OpsRange }) {
  const [openRun, setOpenRun] = useQueryState("open", parseAsString);
  const [source, setSource] = useQueryState("source", parseAsString);
  const { data, isLoading, error } = useOpsQuery<OpsRuns>(["runs", range], `/api/ops/runs?range=${range}`);

  const chart = useMemo(() => {
    if (!data) return [];
    return bucketStarts(new Date(data.since), new Date(data.generatedAt), data.bucketMs).map((b) => {
      const x = data.buckets.find((k) => k.bucket === b);
      return {
        bucket: fmtBucket(b, data.bucketMs),
        Succeeded: x?.success ?? 0,
        Partial: x?.partial ?? 0,
        Failed: x?.failed ?? 0,
        Running: x?.running ?? 0,
      };
    });
  }, [data]);

  if (error && !data) return <LoadError error={error} />;

  const all = data?.runs ?? [];
  const runs = source ? all.filter((r) => r.source === source) : all;
  const failed = all.filter((r) => r.status === "failed").length;
  const running = all.filter((r) => r.status === "running").length;
  const finished = all.filter((r) => r.status !== "running");
  const succeeded = finished.length - failed;
  const durations = finished.map((r) => r.durationS ?? 0).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;

  const columns: ColumnMetadata<EtlRunRow>[] = [
    {
      columnId: "startedAt",
      title: "Started (CT)",
      type: "text",
      sortable: true,
      columnClassName: "w-[14%]",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => void setOpenRun(row.original.runId)}
          className="text-left text-xs hover:text-basecast-brand hover:underline"
        >
          {fmtDayTime(row.original.startedAt)}
        </button>
      ),
    },
    {
      columnId: "source",
      title: "Source",
      type: "text",
      sortable: true,
      filters: { checkbox: true },
      inferOptions: true,
      columnClassName: "w-[22%]",
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.source}</span>,
    },
    {
      columnId: "stage",
      title: "Stage",
      type: "text",
      sortable: true,
      filters: { checkbox: true },
      inferOptions: true,
      columnClassName: "w-[8%]",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.stage}</span>,
    },
    {
      columnId: "status",
      title: "Status",
      type: "text",
      sortable: true,
      filters: { checkbox: true },
      inferOptions: true,
      columnClassName: "w-[10%]",
      cell: ({ row }) => <RunStatusBadge status={row.original.status} />,
    },
    {
      columnId: "durationS",
      title: "Duration",
      type: "number",
      sortable: true,
      aligned: "right",
      filters: { number: true },
      columnClassName: "w-[12%]",
      cell: ({ row }) => {
        const r = row.original;
        if (r.status === "running") return <span className="text-muted-foreground">…</span>;
        const slow = r.durationS !== null && r.medianS ? r.durationS / r.medianS > SLOW_RATIO : false;
        return (
          <span
            className={cn("tabular-nums", slow && "font-semibold text-amber-700 dark:text-amber-300")}
            title={r.medianS ? `Median for this source: ${fmtDuration(r.medianS * 1_000)}` : undefined}
          >
            {fmtDuration((r.durationS ?? 0) * 1_000)}
          </span>
        );
      },
    },
    { columnId: "rows", title: "Rows", type: "number", sortable: true, aligned: "right", columnClassName: "w-[9%]", formatter: (v) => (v == null ? "—" : fmtInt(v as number)) },
    { columnId: "tryNumber", title: "Try", type: "number", sortable: true, aligned: "right", columnClassName: "w-[5%]", formatter: (v) => (v == null ? "—" : String(v)) },
    {
      columnId: "error",
      title: "Error",
      type: "text",
      columnClassName: "w-[20%]",
      cell: ({ row }) =>
        row.original.error ? (
          <span className="block max-w-80 truncate font-mono text-xs text-red-600 dark:text-red-400" title={row.original.error}>
            {row.original.error}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard Icon={Activity} isLoading={isLoading} value={fmtInt(all.length)} label="Total runs" note={median === null ? "—" : `Median duration: ${fmtDuration(median * 1_000)}`} accent={ACCENT.blue} />
        <KpiCard
          Icon={CircleCheck}
          iconClassName="text-basecast-brand"
          isLoading={isLoading}
          value={fmtInt(succeeded)}
          label="Succeeded"
          note={finished.length ? `Success rate: ${Math.round((succeeded / finished.length) * 100)}%` : "No finished runs"}
          accent={ACCENT.brand}
        />
        <KpiCard
          Icon={TriangleAlert}
          iconClassName={failed ? "text-red-600" : "text-muted-foreground"}
          isLoading={isLoading}
          value={fmtInt(failed)}
          label="Failed"
          note={failed ? "Open a run below to investigate" : "No failures in the period"}
          accent={failed ? ACCENT.red : ACCENT.brand}
        />
        <KpiCard
          Icon={Loader2}
          iconClassName={running ? "animate-spin text-amber-600 motion-reduce:animate-none" : "text-muted-foreground"}
          isLoading={isLoading}
          value={fmtInt(running)}
          label="Running"
          note={running ? "In progress now" : "No run in progress"}
          accent={running ? ACCENT.amber : ACCENT.brand}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <SectionCard title="Runs over time" subtitle={`Runs per bucket, ${RANGE_LABEL[range]}`}>
          <div className="h-72 min-h-0">
            {!data ? (
              <ChartSkeleton className="h-full" />
            ) : data.runs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No runs in the period.</div>
            ) : (
              <AreaChart
                className="h-full"
                data={chart}
                index="bucket"
                categories={["Succeeded", "Partial", "Failed", "Running"]}
                colors={["emerald", "amber", "red", "blue"]}
                type="stacked"
                showLegend
                yAxisWidth={40}
                valueFormatter={fmtInt}
              />
            )}
          </div>
        </SectionCard>
        <SectionCard title="By source" subtitle="Click a source to filter the runs">
          <div className="h-72 min-h-0 overflow-y-auto">
            {!data ? (
              <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : data.sources.length === 0 ? (
              <EmptyState compact className="h-full" Icon={Workflow} title="No source ran in the period" />
            ) : (
              <div className="rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 z-10 bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Source</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Runs</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">%</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">p50</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">p95</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Last</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sources.map((s) => {
                      const selected = source === s.source;
                      const toggle = () => void setSource(selected ? null : s.source);
                      return (
                        <tr
                          key={s.source}
                          className={cn("cursor-pointer border-t border-border", selected ? "bg-basecast-brand-surface" : "hover:bg-muted/30")}
                          onClick={toggle}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              toggle();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selected}
                        >
                          <td className="px-3 py-2 font-mono">{s.source}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{fmtInt(s.runs)}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{Math.round(s.successRate * 100)}%</td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtDuration(s.p50S === null ? null : s.p50S * 1_000)}</td>
                          <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{fmtDuration(s.p95S === null ? null : s.p95S * 1_000)}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <RunStatusBadge status={s.lastStatus} />
                              <span className="text-muted-foreground">{fmtAgo(s.lastAt)}</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Runs"
        subtitle={isLoading ? "—" : `${fmtInt(runs.length)} runs in the period; a duration over ${SLOW_RATIO}× the source's median is in amber. Open a run by its start time.`}
        action={
          source && (
            <button
              type="button"
              onClick={() => void setSource(null)}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent"
            >
              <span className="text-muted-foreground">Source:</span>
              <span className="font-mono">{source}</span>
              <span className="text-muted-foreground">×</span>
            </button>
          )
        }
      >
        {isLoading ? (
          <SkeletonDatatable />
        ) : (
          <DataTable<EtlRunRow>
            columnsMetadata={columns}
            data={runs}
            pageSize={50}
            tableName="ops-runs"
            language="en"
            bordered
            compact
            paginationDisplayTop
            toolbarIconsOnly
            initialSorting={[{ id: "startedAt", desc: true }]}
            getRowId={(r) => r.runId}
          />
        )}
      </SectionCard>

      <RunDetailSheet runId={openRun} onClose={() => void setOpenRun(null)} />
    </div>
  );
}
