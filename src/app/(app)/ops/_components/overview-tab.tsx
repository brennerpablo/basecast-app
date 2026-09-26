"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";

import { AreaChart } from "@/components/components-app/charts/area-chart";
import { BarChart } from "@/components/components-app/charts/bar-chart";
import { StatusMap, type StatusMapEntry } from "@/components/components-app/charts/status-map";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bucketStarts } from "@/lib/ops/range";
import type { OpsOverview, OpsRange, PipelineHealth, RequestServiceHealth } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { fmtAgo, fmtBucket, fmtDayTime, fmtDuration, fmtInt } from "./format";
import { HealthBadge, QueryState, RANGE_LABEL, SERVICE_COLOR, ServiceLabel, useOpsQuery } from "./ops-bits";

const SERVICE_TITLE = { app: "BaseCast app", "get-data": "get-data API" } as const;
const SERVICE_WHERE = { app: "Next.js BFF · Vercel", "get-data": "FastAPI · Cloud Run" } as const;

function Kpi({ label, value, unit, bad }: { label: string; value: string; unit?: string; bad?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums", bad && "text-destructive")}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-medium text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function ServiceCard({ s }: { s: RequestServiceHealth }) {
  const rate = s.requests ? (s.errors5xx / s.requests) * 100 : 0;
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <ServiceLabel service={s.service} />
          <div className="font-semibold">{SERVICE_TITLE[s.service]}</div>
          <div className="text-xs text-muted-foreground">
            {[SERVICE_WHERE[s.service], s.host, s.version].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="ml-auto"><HealthBadge status={s.status} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Requests" value={fmtInt(s.requests)} />
        <Kpi label="5xx rate" value={rate.toFixed(1)} unit="%" bad={s.errors5xx > 0} />
        <Kpi label="p95" value={s.p95Ms === null ? "—" : fmtInt(s.p95Ms)} unit={s.p95Ms === null ? undefined : "ms"} />
      </div>
      <div className="border-t pt-2 text-xs text-muted-foreground">
        {s.reason} · last line {fmtAgo(s.lastAt)}
      </div>
    </div>
  );
}

function PipelineCard({ p }: { p: PipelineHealth }) {
  const maxDur = Math.max(1, ...p.recent.map((r) => r.durationS ?? 0));
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <ServiceLabel service="airflow" />
          <div className="font-semibold">Pipelines</div>
          <div className="text-xs text-muted-foreground">Airflow · etl_run</div>
        </div>
        <div className="ml-auto"><HealthBadge status={p.status} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Kpi label="Runs" value={fmtInt(p.runs)} />
        <Kpi label="Failed" value={fmtInt(p.failed)} bad={p.failed > 0} />
        <Kpi label="Rows written" value={p.rows >= 10_000 ? `${(p.rows / 1_000).toFixed(1)}` : fmtInt(p.rows)} unit={p.rows >= 10_000 ? "K" : undefined} />
      </div>
      {p.recent.length > 0 && (
        <div className="flex h-9 items-end gap-[3px]" aria-label={`Last ${p.recent.length} runs`}>
          {p.recent.map((r, i) => (
            <span
              key={i}
              title={`${r.source} · ${r.status} · ${fmtDuration((r.durationS ?? 0) * 1_000)}`}
              className={cn(
                "min-w-1 flex-1 rounded-t-[2px]",
                r.status === "failed" ? "bg-red-500" : r.status === "partial" || r.status === "abandoned" ? "bg-amber-500" : r.status === "running" ? "bg-blue-500" : "bg-emerald-500",
              )}
              style={{ height: `${25 + 75 * Math.min(1, (r.durationS ?? 0) / maxDur)}%` }}
            />
          ))}
        </div>
      )}
      <div className="border-t pt-2 text-xs text-muted-foreground">
        {p.reason} · last run {fmtAgo(p.lastAt)}
      </div>
    </div>
  );
}

const GRID_LABELS = {
  success: { color: "bg-emerald-500", label: "Succeeded" },
  partial: { color: "bg-amber-500", label: "Partial or recovered" },
  failed: { color: "bg-red-500", label: "Failed" },
  running: { color: "bg-blue-500", label: "Running" },
  abandoned: { color: "bg-slate-400", label: "Abandoned" },
  none: { color: "bg-muted", label: "No run" },
};

export function OverviewTab({ range }: { range: OpsRange }) {
  const { data, isLoading, error } = useOpsQuery<OpsOverview>(["overview", range], `/api/ops/overview?range=${range}`);

  const charts = useMemo(() => {
    if (!data) return null;
    const starts = bucketStarts(new Date(data.since), new Date(data.generatedAt), data.bucketMs);
    const at = (bucket: string, service: "app" | "get-data") =>
      data.traffic.find((t) => t.bucket === bucket && t.service === service);
    const volume = starts.map((b) => {
      const a = at(b, "app"), g = at(b, "get-data");
      return {
        label: fmtBucket(b, data.bucketMs),
        "2xx–3xx": (a?.ok ?? 0) + (g?.ok ?? 0),
        "4xx": (a?.e4 ?? 0) + (g?.e4 ?? 0),
        "5xx": (a?.e5 ?? 0) + (g?.e5 ?? 0),
      };
    });
    const latency = starts.map((b) => ({
      label: fmtBucket(b, data.bucketMs),
      app: at(b, "app")?.p95Ms ?? null,
      "get-data": at(b, "get-data")?.p95Ms ?? null,
    }));
    return { volume, latency };
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

  if (!data) return <QueryState isLoading={isLoading} error={error} />;

  return (
    <div className="flex flex-col gap-5">
      <QueryState isLoading={false} error={error} />
      <div className="grid gap-3 lg:grid-cols-3">
        {data.services.map((s) => <ServiceCard key={s.service} s={s} />)}
        <PipelineCard p={data.pipelines} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Requests</h2>
          <p className="mb-2 text-xs text-muted-foreground">app + get-data, by status class, {RANGE_LABEL[range]}</p>
          <BarChart
            className="h-52"
            data={charts!.volume}
            index="label"
            categories={["2xx–3xx", "4xx", "5xx"]}
            colors={["teal", "amber", "red"]}
            type="stacked"
            valueFormatter={fmtInt}
            allowDecimals={false}
          />
        </section>
        <section className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold">p95 latency</h2>
          <p className="mb-2 text-xs text-muted-foreground">ms; the app line includes its wait for get-data</p>
          <AreaChart
            className="h-52"
            data={charts!.latency}
            index="label"
            categories={["app", "get-data"]}
            colors={[SERVICE_COLOR.app, SERVICE_COLOR["get-data"]]}
            fill="none"
            valueFormatter={(v) => `${fmtInt(v)} ms`}
          />
        </section>
      </div>

      <section className="rounded-lg border p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-sm font-semibold">Pipeline runs</h2>
          <span className="text-xs text-muted-foreground">last 14 days, one cell per source per day (CT)</span>
          <Link href={`/ops?tab=pipelines&range=${range}`} className="ml-auto inline-flex items-center text-sm font-medium text-basecast-brand hover:underline">
            All runs <ChevronRight className="size-4" />
          </Link>
        </div>
        {grid.length ? (
          <StatusMap data={grid} labelConfig={GRID_LABELS} tooltip initialScroll="end" style="tight" />
        ) : (
          <p className="text-sm text-muted-foreground">No pipeline runs in the last 14 days.</p>
        )}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-sm font-semibold">Top errors</h2>
          <span className="text-xs text-muted-foreground">grouped by error and place, {RANGE_LABEL[range]}</span>
        </div>
        {data.topErrors.length === 0 ? (
          <p className="rounded-lg border px-4 py-6 text-center text-sm text-muted-foreground">No errors in the {RANGE_LABEL[range]}.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Count</TableHead>
                  <TableHead>First seen</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topErrors.map((e) => (
                  <TableRow key={e.key}>
                    <TableCell><ServiceLabel service={e.service} /></TableCell>
                    <TableCell className="min-w-72 whitespace-normal">
                      {e.errorClass && <span className="mr-1.5 font-mono text-xs font-semibold text-destructive">{e.errorClass}</span>}
                      {e.message}
                      {e.place && <div className="font-mono text-xs text-muted-foreground">{e.place}</div>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{fmtInt(e.count)}</TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">{fmtDayTime(e.firstAt)}</TableCell>
                    <TableCell className="tabular-nums">{fmtDayTime(e.lastAt)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/ops?tab=logs&range=${range}&q=${encodeURIComponent(e.key)}`}
                        className="inline-flex items-center text-sm font-medium text-basecast-brand hover:underline"
                      >
                        Logs <ChevronRight className="size-4" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
