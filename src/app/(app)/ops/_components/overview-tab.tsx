"use client";

import { Activity, AppWindow, Bug, ChevronRight, CircleCheck, Server, Timer, TriangleAlert, Workflow } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { AreaChart } from "@/components/components-app/charts/area-chart";
import { StatusMap, type StatusMapEntry } from "@/components/components-app/charts/status-map";
import EmptyState from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { bucketStarts } from "@/lib/ops/range";
import type { OpsOverview, OpsRange, RequestServiceHealth } from "@/lib/ops/types";

import { fmtAgo, fmtBucket, fmtDayTime, fmtDuration, fmtInt } from "./format";
import {
  ACCENT,
  ChartSkeleton,
  HEALTH_ACCENT,
  HealthBadge,
  KpiCard,
  LoadError,
  RANGE_LABEL,
  SectionCard,
  SERVICE_COLOR,
  ServiceLabel,
  useOpsQuery,
} from "./ops-bits";

const SERVICE_ICON = { app: AppWindow, "get-data": Server } as const;

function serviceNote(s: RequestServiceHealth): string {
  const rate = s.requests ? `${((s.errors5xx / s.requests) * 100).toFixed(1)}% 5xx` : "no requests";
  const p95 = s.p95Ms === null ? null : `p95 ${fmtDuration(s.p95Ms)}`;
  return [p95, rate].filter(Boolean).join(" · ");
}

const GRID_LABELS = {
  success: { color: "bg-emerald-500", label: "Succeeded" },
  partial: { color: "bg-amber-500", label: "Partial" },
  failed: { color: "bg-red-500", label: "Failed" },
  running: { color: "bg-blue-500", label: "Running" },
  abandoned: { color: "bg-slate-400", label: "Abandoned" },
  none: { color: "bg-muted", label: "No run" },
};

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="rounded-md border border-border">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="grid grid-cols-[0.6fr_2fr_0.4fr_0.8fr_0.8fr] gap-3 border-t border-border px-3 py-2.5 first:border-t-0">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-3 w-full" />)}
        </div>
      ))}
    </div>
  );
}

export function OverviewTab({ range }: { range: OpsRange }) {
  const { data, isLoading, error } = useOpsQuery<OpsOverview>(["overview", range], `/api/ops/overview?range=${range}`);

  const charts = useMemo(() => {
    if (!data) return null;
    const starts = bucketStarts(new Date(data.since), new Date(data.generatedAt), data.bucketMs);
    const at = (bucket: string, service: "app" | "get-data") =>
      data.traffic.find((t) => t.bucket === bucket && t.service === service);
    return {
      volume: starts.map((b) => {
        const a = at(b, "app"), g = at(b, "get-data");
        return {
          bucket: fmtBucket(b, data.bucketMs),
          "2xx–3xx": (a?.ok ?? 0) + (g?.ok ?? 0),
          "4xx": (a?.e4 ?? 0) + (g?.e4 ?? 0),
          "5xx": (a?.e5 ?? 0) + (g?.e5 ?? 0),
        };
      }),
      latency: starts.map((b) => ({
        bucket: fmtBucket(b, data.bucketMs),
        app: at(b, "app")?.p95Ms ?? null,
        "get-data": at(b, "get-data")?.p95Ms ?? null,
      })),
    };
  }, [data]);

  const grid = useMemo<StatusMapEntry[]>(() => {
    if (!data) return [];
    const today = Date.parse(data.generatedAt);
    const days = Array.from({ length: 14 }, (_, i) =>
      new Date(today - (13 - i) * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Chicago" }),
    );
    const sources = [...new Set(data.pipelineDays.map((d) => d.source))].sort();
    return sources.flatMap((source) =>
      days.map((date) => ({
        row: source,
        date,
        status: data.pipelineDays.find((d) => d.source === source && d.day === date)?.status ?? "none",
      })),
    );
  }, [data]);

  if (error && !data) return <LoadError error={error} />;

  const errorCount = data?.topErrors.reduce((s, e) => s + e.count, 0) ?? 0;
  const pipes = data?.pipelines;
  const services: { service: "app" | "get-data"; health: RequestServiceHealth | null }[] = (["app", "get-data"] as const).map(
    (service) => ({ service, health: data?.services.find((s) => s.service === service) ?? null }),
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {services.map(({ service, health }) => (
          <KpiCard
            key={service}
            Icon={SERVICE_ICON[service]}
            isLoading={isLoading}
            value={health ? fmtInt(health.requests) : "—"}
            label={<span className="inline-flex items-center gap-1"><ServiceLabel service={service} /> requests</span>}
            note={health ? serviceNote(health) : undefined}
            accent={health ? HEALTH_ACCENT[health.status] : ACCENT.muted}
            badge={health && <HealthBadge status={health.status} />}
          />
        ))}
        <KpiCard
          Icon={Workflow}
          isLoading={isLoading}
          value={pipes ? fmtInt(pipes.runs) : "—"}
          label={<span className="inline-flex items-center gap-1"><ServiceLabel service="airflow" /> pipeline runs</span>}
          note={pipes ? (pipes.status === "healthy" ? `last run ${fmtAgo(pipes.lastAt)}` : pipes.reason) : undefined}
          accent={pipes ? HEALTH_ACCENT[pipes.status] : ACCENT.muted}
          badge={pipes && <HealthBadge status={pipes.status} />}
        />
        <KpiCard
          Icon={errorCount ? TriangleAlert : CircleCheck}
          iconClassName={errorCount ? "text-red-600" : "text-basecast-brand"}
          isLoading={isLoading}
          value={fmtInt(errorCount)}
          label="Errors"
          note={errorCount ? `${data!.topErrors.length} distinct` : undefined}
          accent={errorCount ? ACCENT.red : ACCENT.brand}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <SectionCard title="Requests over time" icon={Activity}>
          <div className="h-72 min-h-0">
            {charts ? (
              <AreaChart
                className="h-full"
                data={charts.volume}
                index="bucket"
                categories={["2xx–3xx", "4xx", "5xx"]}
                colors={["emerald", "amber", "red"]}
                type="stacked"
                showLegend
                yAxisWidth={40}
                valueFormatter={fmtInt}
              />
            ) : (
              <ChartSkeleton className="h-full" />
            )}
          </div>
        </SectionCard>
        <SectionCard title="p95 latency" icon={Timer} info="The app line includes its wait for get-data.">
          <div className="h-72 min-h-0">
            {charts ? (
              <AreaChart
                className="h-full"
                data={charts.latency}
                index="bucket"
                categories={["app", "get-data"]}
                colors={[SERVICE_COLOR.app, SERVICE_COLOR["get-data"]]}
                fill="none"
                showLegend
                yAxisWidth={70}
                valueFormatter={(v) => fmtDuration(v)}
              />
            ) : (
              <ChartSkeleton className="h-full" />
            )}
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Pipeline runs"
        icon={Workflow}
        subtitle="Last 14 days"
        action={
          <Link href={`/ops?tab=pipelines&range=${range}`} className="inline-flex items-center text-xs font-medium text-basecast-brand hover:underline">
            All runs <ChevronRight className="size-3.5" />
          </Link>
        }
      >
        {!data ? (
          <TableSkeleton rows={5} />
        ) : grid.length ? (
          <StatusMap data={grid} labelConfig={GRID_LABELS} tooltip initialScroll="end" style="tight" />
        ) : (
          <EmptyState compact Icon={Workflow} title="No pipeline runs in the last 14 days" />
        )}
      </SectionCard>

      <SectionCard title="Top errors" icon={Bug}>
        {!data ? (
          <TableSkeleton />
        ) : data.topErrors.length === 0 ? (
          <EmptyState compact Icon={CircleCheck} iconClassName="text-basecast-brand" title={`No errors in the ${RANGE_LABEL[range]}`} />
        ) : (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Service</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Error</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Count</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">First seen</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Last seen</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {data.topErrors.map((e) => (
                  <tr key={e.key} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2"><ServiceLabel service={e.service} /></td>
                    <td className="min-w-72 px-3 py-2">
                      {e.errorClass && <span className="mr-1.5 font-mono font-semibold text-red-600 dark:text-red-400">{e.errorClass}</span>}
                      {e.message}
                      {e.place && <div className="font-mono text-[11px] text-muted-foreground">{e.place}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtInt(e.count)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted-foreground tabular-nums">{fmtDayTime(e.firstAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">{fmtDayTime(e.lastAt)}</td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/ops?tab=logs&range=${range}&q=${encodeURIComponent(e.key)}`}
                        className="inline-flex items-center font-medium text-basecast-brand hover:underline"
                      >
                        Logs <ChevronRight className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
