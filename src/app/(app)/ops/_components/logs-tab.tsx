"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useMemo } from "react";

import { useTabState } from "@/components/tabs/tab-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { OPS_LEVELS, OPS_SERVICES, type OpsLogEntry, type OpsLogPage, type OpsRange } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { fmtDuration, fmtInt, fmtLogTime } from "./format";
import { LevelBadge, OPS_REFETCH_MS, QueryState, SERVICE_COLOR, ServiceLabel, useOpsQuery } from "./ops-bits";

function logsUrl(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) search.set(k, v);
  return `/api/ops/logs?${search}`;
}

/**
 * The spans of one request: each `http.request` line is a bar (its start is `ts − duration_ms`), every
 * other line a dot on the bar of its service.
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
    return { spans, marks: lines.filter((l) => l.event !== "http.request"), total, pct, t0 };
  }, [data]);
  if (!trace) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold">Trace</h3>
      <div className="flex flex-col gap-1.5">
        {trace.spans.map(({ line, start, end }) => (
          <div key={line.id} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-2 text-xs">
            <span className="truncate" title={`${line.method} ${line.route}`}>
              <ServiceLabel service={line.service} />
            </span>
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
        <div className="flex justify-between pl-34 text-[11px] text-muted-foreground tabular-nums">
          <span>0</span>
          <span>{fmtDuration(trace.total / 2)}</span>
          <span>{fmtDuration(trace.total)}</span>
        </div>
      </div>
    </div>
  );
}

function LogDetail({ entry, onFilter }: { entry: OpsLogEntry; onFilter: (key: "request" | "run", id: string) => void }) {
  const rows: [string, string | null][] = [
    ["event", entry.event],
    ["route", entry.route ? `${entry.method ?? ""} ${entry.route}`.trim() : null],
    ["status", entry.status === null ? null : String(entry.status)],
    ["duration", entry.durationMs === null ? null : `${fmtInt(entry.durationMs)} ms`],
    ["request_id", entry.requestId],
    ["run_id", entry.runId],
    ["user_id", entry.userId],
    ["fingerprint", entry.fingerprint],
    ["version", entry.version],
    ["host", entry.host],
    ["env", entry.env],
    ["time (UTC)", entry.ts],
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <LevelBadge level={entry.level} />
        <ServiceLabel service={entry.service} />
        <span className="font-mono text-xs text-muted-foreground">{fmtLogTime(entry.ts)} CT</span>
      </div>
      <h3 className="text-sm leading-snug font-semibold wrap-break-word">{entry.message}</h3>
      <dl className="grid grid-cols-[6rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
        {rows.filter(([, v]) => v).map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono break-all">{v}</dd>
          </div>
        ))}
      </dl>
      {entry.requestId && <Trace requestId={entry.requestId} />}
      {entry.errorStack && (
        <div>
          <h3 className="mb-1 text-xs font-semibold">Stack</h3>
          <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed text-destructive">{entry.errorStack}</pre>
        </div>
      )}
      {entry.context && (
        <div>
          <h3 className="mb-1 text-xs font-semibold">Context</h3>
          <pre className="max-h-56 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px] leading-relaxed">{JSON.stringify(entry.context, null, 2)}</pre>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {entry.requestId && (
          <Button variant="outline" size="sm" onClick={() => onFilter("request", entry.requestId!)}>All lines of this request</Button>
        )}
        {entry.runId && (
          <Button variant="outline" size="sm" onClick={() => onFilter("run", entry.runId!)}>All lines of this run</Button>
        )}
      </div>
    </div>
  );
}

export function LogsTab({ range }: { range: OpsRange }) {
  const [q, setQ] = useQueryState("q", parseAsString.withDefault("").withOptions({ throttleMs: 400 }));
  const [levels, setLevels] = useQueryState("levels", parseAsArrayOf(parseAsStringLiteral(OPS_LEVELS)).withDefault([...OPS_LEVELS]));
  const [services, setServices] = useQueryState("services", parseAsArrayOf(parseAsStringLiteral(OPS_SERVICES)).withDefault([...OPS_SERVICES]));
  const [requestId, setRequestId] = useQueryState("request", parseAsString);
  const [runId, setRunId] = useQueryState("run", parseAsString);
  const [selectedId, setSelectedId] = useTabState<string | null>("ops.logs.selected", null);

  const baseParams = {
    range,
    q: q || undefined,
    level: levels.length < OPS_LEVELS.length ? levels.join(",") : undefined,
    service: services.length < OPS_SERVICES.length ? services.join(",") : undefined,
    request: requestId ?? undefined,
    run: runId ?? undefined,
  };
  const query = useInfiniteQuery({
    queryKey: ["ops", "logs", baseParams],
    queryFn: async ({ pageParam }) => {
      const res = await fetch(logsUrl({ ...baseParams, before: pageParam ?? undefined }));
      if (!res.ok) throw new Error(`The server answered ${res.status}`);
      return (await res.json()) as OpsLogPage;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore,
    refetchInterval: OPS_REFETCH_MS,
    staleTime: 0,
  });
  const entries = query.data?.pages.flatMap((p) => p.entries) ?? [];
  const counts = query.data?.pages[0]?.levelCounts;
  const selected = entries.find((e) => e.id === selectedId) ?? entries.find((e) => e.level === "error") ?? entries[0];

  const toggle = <T extends string>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => void setQ(e.target.value || null)}
            placeholder="Search message, event, route, error, request or run id"
            aria-label="Search logs"
            className="pl-8"
          />
        </div>
        {OPS_LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            aria-pressed={levels.includes(level)}
            onClick={() => void setLevels(toggle(levels, level))}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs text-muted-foreground aria-pressed:border-basecast-brand-border aria-pressed:bg-basecast-brand-surface aria-pressed:text-foreground"
          >
            <span className="font-mono font-bold uppercase">{level}</span>
            <span className="tabular-nums">{counts ? fmtInt(counts[level]) : ""}</span>
          </button>
        ))}
        {OPS_SERVICES.map((service) => (
          <button
            key={service}
            type="button"
            aria-pressed={services.includes(service)}
            onClick={() => void setServices(toggle(services, service))}
            className="inline-flex h-8 items-center rounded-full border px-3 text-muted-foreground aria-pressed:border-basecast-brand-border aria-pressed:bg-basecast-brand-surface aria-pressed:text-foreground"
          >
            <ServiceLabel service={service} />
          </button>
        ))}
        {(requestId || runId) && (
          <Button variant="outline" size="sm" onClick={() => { void setRequestId(null); void setRunId(null); }}>
            Showing one {requestId ? "request" : "run"} · show all
          </Button>
        )}
      </div>

      <QueryState isLoading={query.isLoading} error={query.error} />

      {query.data && (
        <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time (CT)</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Request / run</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                      No lines match these filters. Clear the search or turn a level or service back on.
                    </TableCell>
                  </TableRow>
                )}
                {entries.map((e) => (
                  <TableRow
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={cn("cursor-pointer", e.id === selected?.id && "bg-basecast-brand-surface")}
                    aria-selected={e.id === selected?.id}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{fmtLogTime(e.ts)}</TableCell>
                    <TableCell><LevelBadge level={e.level} /></TableCell>
                    <TableCell><ServiceLabel service={e.service} /></TableCell>
                    <TableCell className="min-w-72 whitespace-normal">
                      <div className="text-sm wrap-break-word">{e.message}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {[e.event, e.route, e.durationMs === null ? null : fmtDuration(e.durationMs)].filter(Boolean).join(" · ")}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-40 truncate font-mono text-[11px]" title={e.requestId ?? e.runId ?? undefined}>
                      {e.requestId ?? e.runId ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {query.hasNextPage && (
              <div className="border-t p-2 text-center">
                <Button variant="ghost" size="sm" disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
                  {query.isFetchingNextPage ? "Loading…" : "Show older lines"}
                </Button>
              </div>
            )}
          </div>
          <aside className="rounded-lg border p-4 xl:sticky xl:top-3" aria-live="polite">
            {selected ? (
              <LogDetail
                entry={selected}
                onFilter={(key, id) => void (key === "request" ? setRequestId(id) : setRunId(id))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a line to see its context.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
