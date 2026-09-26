"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { Fragment } from "react";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { EtlRunDetail, EtlRunRow, OpsRange } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { fmtDayTime, fmtDuration, fmtInt, fmtLogTime } from "./format";
import { LevelBadge, QueryState, RANGE_LABEL, RunStatusBadge, useOpsQuery } from "./ops-bits";

/** A run slower than this multiple of its source's median gets an amber bar. */
const SLOW_RATIO = 2;

function DurationBar({ run }: { run: EtlRunRow }) {
  if (run.durationS === null || !run.medianS) return null;
  const ratio = run.durationS / run.medianS;
  return (
    <span
      className="ml-2 inline-block h-1.5 w-14 overflow-hidden rounded-full bg-muted align-middle"
      title={`${ratio.toFixed(1)}× this source's median`}
    >
      <span
        className={cn("block h-full rounded-full", ratio > SLOW_RATIO ? "bg-amber-500" : "bg-muted-foreground/40")}
        style={{ width: `${Math.min(100, ratio * 50)}%` }}
      />
    </span>
  );
}

type RunEvent = { at?: string; kind?: string; [key: string]: unknown };

function RunDetail({ runId }: { runId: string }) {
  const { data, isLoading, error } = useOpsQuery<EtlRunDetail>(["run", runId], `/api/ops/runs/${encodeURIComponent(runId)}`);
  if (!data) return <QueryState isLoading={isLoading} error={error} />;
  const events = (Array.isArray(data.run.events) ? data.run.events : []) as RunEvent[];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>run_id <span className="font-mono text-foreground">{data.run.runId}</span></span>
        {data.run.dagId && <span>DAG <span className="font-mono text-foreground">{data.run.dagId}</span></span>}
        {data.run.tryNumber !== null && <span>try {data.run.tryNumber}</span>}
        {data.run.files !== null && <span>{fmtInt(data.run.files)} files</span>}
      </div>
      {data.run.error && (
        <pre className="overflow-x-auto rounded-md border border-destructive/40 bg-destructive/5 p-3 font-mono text-xs whitespace-pre-wrap text-destructive">
          {data.run.error}
        </pre>
      )}
      {events.length > 0 && (
        <div>
          <h3 className="mb-1 text-xs font-semibold">Events ({fmtInt(events.length)})</h3>
          <pre className="max-h-64 overflow-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed">
            {events.slice(0, 200).map((e, i) => {
              const { at, kind, ...rest } = e;
              return (
                <div key={i} className={cn(kind === "error" && "text-destructive")}>
                  <span className="text-muted-foreground">{at ? fmtLogTime(at) : "—"}</span> {String(kind ?? "?").padEnd(13)} {JSON.stringify(rest)}
                </div>
              );
            })}
          </pre>
        </div>
      )}
      <div>
        <h3 className="mb-1 text-xs font-semibold">Log lines ({fmtInt(data.logs.length)})</h3>
        {data.logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">This run wrote no lines to ops.log.</p>
        ) : (
          <div className="max-h-64 overflow-auto rounded-md border bg-background">
            {data.logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 border-b px-3 py-1.5 text-xs last:border-0">
                <span className="font-mono text-muted-foreground">{fmtLogTime(l.ts)}</span>
                <LevelBadge level={l.level} />
                <span className="font-mono text-muted-foreground">{l.event}</span>
                <span className="min-w-0 wrap-break-word">{l.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PipelinesTab({ range }: { range: OpsRange }) {
  const [openRun, setOpenRun] = useQueryState("open", parseAsString);
  const { data, isLoading, error } = useOpsQuery<EtlRunRow[]>(["runs", range], `/api/ops/runs?range=${range}`);
  const runs = data ?? [];
  const finished = runs.filter((r) => r.status !== "running");
  const failed = runs.filter((r) => r.status === "failed").length;
  const durations = finished.map((r) => r.durationS ?? 0).sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4">
      <QueryState isLoading={isLoading} error={error} />
      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Runs", value: fmtInt(runs.length), note: RANGE_LABEL[range] },
              { label: "Success rate", value: finished.length ? `${Math.round(((finished.length - failed) / finished.length) * 100)}%` : "—", note: `${fmtInt(failed)} failed`, bad: failed > 0 },
              { label: "Rows written", value: fmtInt(runs.reduce((s, r) => s + (r.rows ?? 0), 0)), note: "by the process stage" },
              { label: "Median duration", value: fmtDuration(durations.length ? durations[Math.floor(durations.length / 2)] * 1_000 : null), note: "per run" },
            ].map((t) => (
              <div key={t.label} className="rounded-lg border p-4">
                <div className="text-xs text-muted-foreground">{t.label}</div>
                <div className={cn("text-2xl font-semibold tabular-nums", t.bad && "text-destructive")}>{t.value}</div>
                <div className="text-xs text-muted-foreground">{t.note}</div>
              </div>
            ))}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
              <h2 className="text-sm font-semibold">Runs</h2>
              <span className="text-xs text-muted-foreground">
                newest first; the bar compares each run with its source’s 30-day median, amber past {SLOW_RATIO}×
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Started (CT)</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                        No pipeline runs in the {RANGE_LABEL[range]}.
                      </TableCell>
                    </TableRow>
                  )}
                  {runs.map((r) => {
                    const open = r.runId === openRun;
                    return (
                      <Fragment key={r.runId}>
                        <TableRow
                          className={cn("cursor-pointer", open && "bg-basecast-brand-surface")}
                          onClick={() => void setOpenRun(open ? null : r.runId)}
                          aria-expanded={open}
                        >
                          <TableCell><RunStatusBadge status={r.status} /></TableCell>
                          <TableCell className="font-mono text-xs">{r.source}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.stage}</TableCell>
                          <TableCell className="tabular-nums">{fmtDayTime(r.startedAt)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {r.status === "running" ? "…" : fmtDuration((r.durationS ?? 0) * 1_000)}
                            <DurationBar run={r} />
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{r.rows === null ? "—" : fmtInt(r.rows)}</TableCell>
                          <TableCell className="w-8 text-muted-foreground">
                            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </TableCell>
                        </TableRow>
                        {open && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell colSpan={7} className="bg-muted/40 whitespace-normal">
                              <RunDetail runId={r.runId} />
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
