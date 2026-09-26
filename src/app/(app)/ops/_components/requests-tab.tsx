"use client";

import Link from "next/link";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { useTabState } from "@/components/tabs/tab-screen";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SLOW_REQUEST_MS } from "@/lib/observability/budgets";
import type { OpsRange, RouteStats } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { fmtDuration, fmtInt } from "./format";
import { QueryState, RANGE_LABEL, ServiceLabel, useOpsQuery } from "./ops-bits";
import { Segmented } from "./segmented";

const SERVICES = ["all", "app", "get-data"] as const;
type SortKey = "requests" | "e4" | "e5" | "p50Ms" | "p95Ms" | "p99Ms";
const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "requests", label: "Requests" },
  { key: "e4", label: "4xx" },
  { key: "e5", label: "5xx" },
  { key: "p50Ms", label: "p50" },
  { key: "p95Ms", label: "p95" },
  { key: "p99Ms", label: "p99" },
];

function Tile({ label, value, note, bad }: { label: string; value: string; note: string; bad?: boolean }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-semibold tabular-nums", bad && "text-destructive")}>{value}</div>
      <div className="text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

export function RequestsTab({ range }: { range: OpsRange }) {
  const [service, setService] = useQueryState("service", parseAsStringLiteral(SERVICES).withDefault("all"));
  const [sort, setSort] = useTabState<SortKey>("ops.requests.sort", "p95Ms");
  const url = `/api/ops/requests?range=${range}${service === "all" ? "" : `&service=${service}`}`;
  const { data, isLoading, error } = useOpsQuery<RouteStats[]>(["requests", range, service], url);

  const rows = [...(data ?? [])].sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  const total = rows.reduce((s, r) => s + r.requests, 0);
  const e5 = rows.reduce((s, r) => s + r.e5, 0);
  // Weighted by each route's traffic: an approximation of the overall percentile, labelled as such.
  const weighted = (k: "p50Ms" | "p95Ms") =>
    total ? rows.reduce((s, r) => s + (r[k] ?? 0) * r.requests, 0) / total : null;

  return (
    <div className="flex flex-col gap-4">
      <Segmented
        label="Service"
        options={SERVICES.map((v) => ({ value: v, label: v === "all" ? "All" : v }))}
        value={service}
        onChange={(v) => void setService(v === "all" ? null : v)}
      />
      <QueryState isLoading={isLoading} error={error} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Requests" value={fmtInt(total)} note={RANGE_LABEL[range]} />
            <Tile label="5xx rate" value={total ? `${((e5 / total) * 100).toFixed(2)}%` : "—"} note={`${fmtInt(e5)} server errors`} bad={e5 > 0} />
            <Tile label="p50" value={fmtDuration(weighted("p50Ms"))} note="weighted by route" />
            <Tile label="p95" value={fmtDuration(weighted("p95Ms"))} note="weighted by route" />
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-sm font-semibold">By route</h2>
              <span className="text-xs text-muted-foreground">
                route templates; p95 over {fmtInt(SLOW_REQUEST_MS)} ms in amber, any 5xx in red; open a route for its logs
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Route</TableHead>
                    {COLUMNS.map((c) => (
                      <TableHead key={c.key} className="text-right" aria-sort={sort === c.key ? "descending" : undefined}>
                        <button type="button" onClick={() => setSort(c.key)} className={cn("hover:text-foreground", sort === c.key && "text-foreground")}>
                          {c.label}{sort === c.key ? " ↓" : ""}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                        No requests in the {RANGE_LABEL[range]}.
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={`${r.service} ${r.method} ${r.route}`}>
                      <TableCell><ServiceLabel service={r.service} /></TableCell>
                      <TableCell>
                        <Link
                          href={`/ops?tab=logs&range=${range}&q=${encodeURIComponent(r.route)}`}
                          className="font-mono text-xs hover:underline"
                        >
                          <span className="mr-1.5 text-muted-foreground">{r.method}</span>
                          {r.route}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.requests)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", !r.e4 && "text-muted-foreground")}>{fmtInt(r.e4)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.e5 ? "font-semibold text-destructive" : "text-muted-foreground")}>{fmtInt(r.e5)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtDuration(r.p50Ms)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", (r.p95Ms ?? 0) > SLOW_REQUEST_MS && "font-semibold text-amber-700 dark:text-amber-300")}>{fmtDuration(r.p95Ms)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtDuration(r.p99Ms)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
