"use client";

import { Activity, Gauge, Timer, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { type ColumnMetadata, DataTable } from "@/components/components-app/data-table";
import SkeletonDatatable from "@/components/skeleton-datatable";
import { SLOW_REQUEST_MS } from "@/lib/observability/budgets";
import type { OpsRange, RouteStats } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { fmtDuration, fmtInt } from "./format";
import { ACCENT, KpiCard, LoadError, RANGE_LABEL, SectionCard, ServiceLabel, useOpsQuery } from "./ops-bits";

export function RequestsTab({ range }: { range: OpsRange }) {
  const { data, isLoading, error } = useOpsQuery<RouteStats[]>(["requests", range], `/api/ops/requests?range=${range}`);
  if (error && !data) return <LoadError error={error} />;

  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.requests, 0);
  const e5 = rows.reduce((s, r) => s + r.e5, 0);
  // Weighted by each route's traffic: an approximation of the overall percentile, labelled as such.
  const weighted = (k: "p50Ms" | "p95Ms") =>
    total ? rows.reduce((s, r) => s + (r[k] ?? 0) * r.requests, 0) / total : null;
  const p95 = weighted("p95Ms");

  const columns: ColumnMetadata<RouteStats>[] = [
    {
      columnId: "service",
      title: "Service",
      type: "text",
      sortable: true,
      filters: { checkbox: true },
      inferOptions: true,
      columnClassName: "w-[10%]",
      cell: ({ row }) => <ServiceLabel service={row.original.service} />,
    },
    {
      columnId: "method",
      title: "Method",
      type: "text",
      sortable: true,
      filters: { checkbox: true },
      inferOptions: true,
      columnClassName: "w-[7%]",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.method}</span>,
    },
    {
      columnId: "route",
      title: "Route",
      type: "text",
      sortable: true,
      filters: { text: true },
      columnClassName: "w-[33%]",
      cell: ({ row }) => (
        <Link
          href={`/ops?tab=logs&range=${range}&q=${encodeURIComponent(row.original.route)}`}
          className="font-mono text-xs hover:text-basecast-brand hover:underline"
        >
          {row.original.route}
        </Link>
      ),
    },
    { columnId: "requests", title: "Requests", type: "number", sortable: true, aligned: "right", filters: { number: true }, formatter: (v) => fmtInt(v as number) },
    {
      columnId: "e4",
      title: "4xx",
      type: "number",
      sortable: true,
      aligned: "right",
      cell: ({ row }) => <span className={cn("tabular-nums", !row.original.e4 && "text-muted-foreground")}>{fmtInt(row.original.e4)}</span>,
    },
    {
      columnId: "e5",
      title: "5xx",
      type: "number",
      sortable: true,
      aligned: "right",
      filters: { number: true },
      cell: ({ row }) => (
        <span className={cn("tabular-nums", row.original.e5 ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground")}>
          {fmtInt(row.original.e5)}
        </span>
      ),
    },
    { columnId: "p50Ms", title: "p50", type: "number", sortable: true, aligned: "right", formatter: (v) => fmtDuration(v as number | null) },
    {
      columnId: "p95Ms",
      title: "p95",
      type: "number",
      sortable: true,
      aligned: "right",
      cell: ({ row }) => (
        <span className={cn("tabular-nums", (row.original.p95Ms ?? 0) > SLOW_REQUEST_MS && "font-semibold text-amber-700 dark:text-amber-300")}>
          {fmtDuration(row.original.p95Ms)}
        </span>
      ),
    },
    { columnId: "p99Ms", title: "p99", type: "number", sortable: true, aligned: "right", formatter: (v) => fmtDuration(v as number | null) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard Icon={Activity} isLoading={isLoading} value={fmtInt(total)} label="Requests" note={`app + get-data, ${RANGE_LABEL[range]}`} accent={ACCENT.blue} />
        <KpiCard
          Icon={TriangleAlert}
          iconClassName={e5 ? "text-red-600" : "text-muted-foreground"}
          isLoading={isLoading}
          value={total ? `${((e5 / total) * 100).toFixed(2)}%` : "—"}
          label="5xx rate"
          note={e5 ? `${fmtInt(e5)} server errors` : "No server errors in the period"}
          accent={e5 ? ACCENT.red : ACCENT.brand}
        />
        <KpiCard Icon={Timer} isLoading={isLoading} value={fmtDuration(weighted("p50Ms"))} label="p50" note="Weighted by route" accent={ACCENT.brand} />
        <KpiCard
          Icon={Gauge}
          iconClassName={p95 !== null && p95 > SLOW_REQUEST_MS ? "text-amber-600" : undefined}
          isLoading={isLoading}
          value={fmtDuration(p95)}
          label="p95"
          note={`Weighted by route; budget ${fmtInt(SLOW_REQUEST_MS)} ms`}
          accent={p95 !== null && p95 > SLOW_REQUEST_MS ? ACCENT.amber : ACCENT.brand}
        />
      </div>

      <SectionCard
        title="By route"
        subtitle={`${fmtInt(rows.length)} routes; templates, never raw URLs. p95 over ${fmtInt(SLOW_REQUEST_MS)} ms in amber, any 5xx in red; open a route for its logs.`}
      >
        {isLoading ? (
          <SkeletonDatatable />
        ) : (
          <DataTable<RouteStats>
            columnsMetadata={columns}
            data={rows}
            pageSize={50}
            tableName="ops-requests"
            language="en"
            bordered
            compact
            paginationDisplayTop
            toolbarIconsOnly
            initialSorting={[{ id: "p95Ms", desc: true }]}
            getRowId={(r) => `${r.service} ${r.method} ${r.route}`}
          />
        )}
      </SectionCard>
    </div>
  );
}
