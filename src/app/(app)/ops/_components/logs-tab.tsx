"use client";

import { ScrollText } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useMemo } from "react";

import { type ColumnMetadata, DataTable } from "@/components/components-app/data-table";
import { FilterSearchInput } from "@/components/components-app/url-filters";
import { Filter, FilterRow } from "@/components/product/filter";
import SkeletonDatatable from "@/components/skeleton-datatable";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { OpsLogEntry, OpsLogPage, OpsRange } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { fmtDayTime, fmtDuration, fmtInt, fmtLogTime } from "./format";
import { Field, FieldBlock, LevelBadge, LoadError, RANGE_LABEL, SectionCard, SERVICE_COLOR, ServiceLabel, useOpsQuery } from "./ops-bits";

/** Lines loaded per view; the table pages and filters them in the browser. */
const LOG_LIMIT = 500;

function logsUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  return `/api/ops/logs?${search}`;
}

/**
 * The spans of one request: each `http.request` line is a bar (its start is `ts − duration_ms`), every
 * other line of the request a dot on its service's bar.
 */
function Trace({ requestId }: { requestId: string }) {
  const { data } = useOpsQuery<OpsLogPage>(["trace", requestId], logsUrl({ range: "30d", request: requestId }));
  const trace = useMemo(() => {
    if (!data) return null;
    const lines = [...data.entries].reverse();
    const spans = lines
      .filter((l) => l.event === "http.request" && l.durationMs !== null)
      .map((l) => ({ line: l, end: Date.parse(l.ts), start: Date.parse(l.ts) - (l.durationMs ?? 0) }));
    if (spans.length === 0) return null;
    const t0 = Math.min(...spans.map((s) => s.start));
    const t1 = Math.max(...spans.map((s) => s.end), ...lines.map((l) => Date.parse(l.ts)));
    const total = Math.max(1, t1 - t0);
    const pct = (t: number) => `${(((t - t0) / total) * 100).toFixed(2)}%`;
    return { spans, marks: lines.filter((l) => l.event !== "http.request"), total, pct };
  }, [data]);
  if (!trace) return null;
  return (
    <FieldBlock label="Trace">
      <div className="space-y-1.5 rounded-md border border-border bg-card p-3">
        {trace.spans.map(({ line, start, end }) => (
          <div key={line.id} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2 text-xs">
            <ServiceLabel service={line.service} />
            <div className="relative h-4 rounded-sm bg-muted">
              <div
                className={cn("absolute inset-y-0 rounded-sm", (line.status ?? 0) >= 500 && "ring-2 ring-red-500 ring-inset")}
                style={{ left: trace.pct(start), width: `max(2px, calc(${trace.pct(end)} - ${trace.pct(start)}))`, background: SERVICE_COLOR[line.service] }}
                title={`${line.method} ${line.route} · ${line.status} · ${fmtDuration(line.durationMs)}`}
              />
              {trace.marks
                .filter((m) => m.service === line.service)
                .map((m) => (
                  <span
                    key={m.id}
                    className={cn("absolute top-0.5 size-3 -translate-x-1/2 rounded-full border-2 border-background", m.level === "error" ? "bg-red-500" : "bg-muted-foreground")}
                    style={{ left: trace.pct(Date.parse(m.ts)) }}
                    title={`${m.event}: ${m.message}`}
                  />
                ))}
            </div>
          </div>
        ))}
        <div className="flex justify-between pl-28 text-[11px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>{fmtDuration(trace.total / 2)}</span>
          <span>{fmtDuration(trace.total)}</span>
        </div>
      </div>
    </FieldBlock>
  );
}

function LogDetailSheet({
  entry,
  onClose,
  onScope,
}: {
  entry: OpsLogEntry | null;
  onClose: () => void;
  onScope: (key: "request" | "run", id: string) => void;
}) {
  return (
    <Sheet open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>Log line</SheetTitle>
          <SheetDescription>{entry ? `${fmtDayTime(entry.ts)} CT · ${fmtLogTime(entry.ts)}` : ""}</SheetDescription>
        </SheetHeader>
        {entry && (
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 text-sm">
            <div className="flex flex-wrap items-center gap-3">
              <LevelBadge level={entry.level} />
              <ServiceLabel service={entry.service} />
              <span className="font-mono text-xs text-muted-foreground">{entry.event}</span>
            </div>
            <Field label="Message" value={entry.message} />
            <div className="grid grid-cols-2 gap-4">
              {entry.route && <Field label="Route" value={`${entry.method ?? ""} ${entry.route}`.trim()} mono />}
              {entry.status !== null && <Field label="Status" value={entry.status} />}
              {entry.durationMs !== null && <Field label="Duration" value={`${fmtInt(entry.durationMs)} ms`} />}
              {entry.requestId && <Field label="Request ID" value={entry.requestId} mono />}
              {entry.runId && <Field label="Run ID" value={entry.runId} mono />}
              {entry.userId && <Field label="User ID" value={entry.userId} mono />}
              {entry.fingerprint && <Field label="Fingerprint" value={entry.fingerprint} mono />}
              {entry.version && <Field label="Version" value={entry.version} mono />}
              {entry.host && <Field label="Host" value={entry.host} mono />}
              <Field label="Environment" value={entry.env} />
              <Field label="Time (UTC)" value={entry.ts} mono />
            </div>
            {entry.requestId && <Trace requestId={entry.requestId} />}
            {entry.errorStack && (
              <FieldBlock label={entry.errorClass ?? "Stack"} tone="error">
                <pre className="overflow-x-auto rounded-md border border-red-200 bg-red-50 p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
                  {entry.errorStack}
                </pre>
              </FieldBlock>
            )}
            <FieldBlock label="Context">
              <pre className="overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs wrap-break-word whitespace-pre-wrap">
                {entry.context ? JSON.stringify(entry.context, null, 2) : "—"}
              </pre>
            </FieldBlock>
            {(entry.requestId || entry.runId) && (
              <div className="flex flex-wrap gap-2">
                {entry.requestId && (
                  <Button variant="outline" size="sm" onClick={() => onScope("request", entry.requestId!)}>
                    All lines of this request
                  </Button>
                )}
                {entry.runId && (
                  <Button variant="outline" size="sm" onClick={() => onScope("run", entry.runId!)}>
                    All lines of this run
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function LogsTab({ range }: { range: OpsRange }) {
  const [q, setQ] = useQueryState("q", parseAsString.withDefault(""));
  const [requestId, setRequestId] = useQueryState("request", parseAsString);
  const [runId, setRunId] = useQueryState("run", parseAsString);
  const [selectedId, setSelectedId] = useQueryState("line", parseAsString);

  const url = logsUrl({ range, q: q || undefined, request: requestId ?? undefined, run: runId ?? undefined, limit: String(LOG_LIMIT) });
  const { data, isLoading, error } = useOpsQuery<OpsLogPage>(["logs", range, q, requestId, runId], url);
  const entries = data?.entries ?? [];
  const selected = entries.find((e) => e.id === selectedId) ?? null;
  const scope = requestId ? { key: "Request", id: requestId } : runId ? { key: "Run", id: runId } : null;

  const columns: ColumnMetadata<OpsLogEntry>[] = [
    {
      columnId: "ts",
      title: "Time (CT)",
      type: "text",
      sortable: true,
      columnClassName: "w-[11%]",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => void setSelectedId(row.original.id)}
          className="text-left font-mono text-xs whitespace-nowrap hover:text-basecast-brand hover:underline"
        >
          {fmtLogTime(row.original.ts)}
        </button>
      ),
    },
    {
      columnId: "level",
      title: "Level",
      type: "text",
      sortable: true,
      filters: { checkbox: true },
      inferOptions: true,
      columnClassName: "w-[7%]",
      cell: ({ row }) => <LevelBadge level={row.original.level} />,
    },
    {
      columnId: "service",
      title: "Service",
      type: "text",
      sortable: true,
      filters: { checkbox: true },
      inferOptions: true,
      columnClassName: "w-[9%]",
      cell: ({ row }) => <ServiceLabel service={row.original.service} />,
    },
    {
      columnId: "event",
      title: "Event",
      type: "text",
      sortable: true,
      filters: { checkboxSearch: true },
      inferOptions: true,
      columnClassName: "w-[12%]",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.event}</span>,
    },
    {
      columnId: "message",
      title: "Message",
      type: "text",
      columnClassName: "w-[37%]",
      cell: ({ row }) => (
        <button
          type="button"
          onClick={() => void setSelectedId(row.original.id)}
          className="block max-w-120 truncate text-left text-xs hover:underline"
          title={row.original.message}
        >
          {row.original.message}
        </button>
      ),
    },
    {
      columnId: "durationMs",
      title: "Duration",
      type: "number",
      sortable: true,
      aligned: "right",
      filters: { number: true },
      columnClassName: "w-[8%]",
      formatter: (v) => (v == null ? "—" : fmtDuration(v as number)),
    },
    {
      columnId: "requestId",
      title: "Request / run",
      type: "text",
      columnClassName: "w-[16%]",
      cell: ({ row }) => {
        const id = row.original.requestId ?? row.original.runId;
        return id ? (
          <span className="block max-w-40 truncate font-mono text-[11px]" title={id}>{id}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <FilterRow>
        <Filter label="Search">
          <FilterSearchInput
            value={q}
            onValueChange={(v) => void setQ(v)}
            placeholder="Message, event, route, error, request or run id"
            className="w-full sm:w-md"
          />
        </Filter>
        {scope && (
          <button
            type="button"
            onClick={() => { void setRequestId(null); void setRunId(null); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs hover:bg-accent"
          >
            <span className="text-muted-foreground">{scope.key}:</span>
            <span className="font-mono">{scope.id}</span>
            <span className="text-muted-foreground">×</span>
          </button>
        )}
      </FilterRow>

      {error && !data ? (
        <LoadError error={error} />
      ) : (
        <SectionCard
          title="Log lines"
          icon={ScrollText}
          subtitle={
            isLoading
              ? "—"
              : `${fmtInt(entries.length)}${data?.nextBefore ? `+ (newest ${fmtInt(LOG_LIMIT)} shown)` : ""} lines ${scope ? `of this ${scope.key.toLowerCase()}` : `in the ${RANGE_LABEL[range]}`}. Open a line by its time or message.`
          }
        >
          {isLoading ? (
            <SkeletonDatatable />
          ) : (
            <DataTable<OpsLogEntry>
              columnsMetadata={columns}
              data={entries}
              pageSize={100}
              tableName="ops-logs"
              language="en"
              bordered
              compact
              paginationDisplayTop
              toolbarIconsOnly
              initialSorting={[{ id: "ts", desc: true }]}
              getRowId={(r) => r.id}
            />
          )}
        </SectionCard>
      )}

      <LogDetailSheet
        entry={selected}
        onClose={() => void setSelectedId(null)}
        onScope={(key, id) => {
          void setSelectedId(null);
          void (key === "request" ? setRequestId(id) : setRunId(id));
        }}
      />
    </div>
  );
}
