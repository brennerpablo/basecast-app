"use client";

import { useQueries } from "@tanstack/react-query";
import { Boxes, History, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { AppBadge } from "@/components/components-app/ui/badge";
import { RunDot } from "@/components/data-browser/file-kind";
import { formatDateTime } from "@/components/data-browser/format";
import { formatDuration } from "@/components/data-browser/runs-view";
import { CardOpenLink } from "@/components/product/dashboard-card-header";
import { formatDate, formatPercent, formatWhole, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { components } from "@/lib/api/get-data";
import { type Envelope, fetchEnvelope, type Meta } from "@/lib/bff/envelope";
import { productKeys, useProductQuery } from "@/lib/bff/queries";
import { runThatBuilt, shortRunId, tally } from "@/lib/model-runs";
import { useModelRuns } from "@/lib/model-runs-query";
import { cn } from "@/lib/utils";

import {
  MODEL,
  type ModelRow,
  modelRows,
  ORGANIC,
  type PeakData,
  PRODUCT_NAME,
  type QueueData,
  queueSummary,
  sourceLabel,
} from "./backtest-data";

type PeakForecastData = components["schemas"]["PeakForecastData"];

/** Our models by name; the official benchmarks keep their product code. */
const MODEL_NAME: Record<string, string> = {
  [MODEL]: "Peak model",
  [ORGANIC]: "Peak model without large loads",
};

const th = "px-3 py-2 font-medium";
const num = "px-3 py-2 text-right tabular-nums";

/** `May 2023 → May 2026 · 8 dates`, or the one date. */
function spanOf(dates: string[]): string {
  if (!dates.length) return GAP;
  const month = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  if (dates.length === 1) return formatDate(dates[0]);
  return `${month(dates[0])} → ${month(dates.at(-1)!)} · ${dates.length} dates`;
}

function GroupRow({ label }: { label: string }) {
  return (
    <tr className="bg-muted/40">
      <th colSpan={7} scope="colgroup" className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
        {label}
      </th>
    </tr>
  );
}

function PeakRow({ row, variantLabel }: { row: ModelRow; variantLabel: (code: string) => string }) {
  const score = row.score;
  return (
    <tr>
      <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
        {row.benchmark ? (
          <span title={PRODUCT_NAME[row.source]}>{sourceLabel(row.source)}</span>
        ) : (
          MODEL_NAME[row.source] ?? sourceLabel(row.source)
        )}
      </th>
      <td className="px-3 py-2 text-xs">
        {row.variants.length ? row.variants.map(variantLabel).join(", ") : <span className="text-muted-foreground">Official</span>}
      </td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{spanOf(row.dates)}</td>
      <td className={num}>{formatWhole(row.cells)}</td>
      <td className={num}>{score ? formatPercent(score.mape) : GAP}</td>
      <td className={num}>{score ? formatPercent(score.bias_pct, { signed: true }) : GAP}</td>
      <td className="px-3 py-2 text-right">
        {row.leaks ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="cursor-help">
                <AppBadge state="alert">{formatWhole(row.leaks)}</AppBadge>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Cells that used information from after their backtest date; the By date tab has each note.
            </TooltipContent>
          </Tooltip>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Every model the backtest ran and the benchmarks it is scored against: the peak model and its ablation over
 * every backtest date (read one date at a time, as the API serves the cells), the generation-queue model over its
 * snapshots, then ERCOT's forecasts. Flags when the forecast screen's default variant is not the one backtested.
 */
function ModelsRun({ peak, meta, queue }: { peak: PeakData; meta: Meta; queue: QueueData | undefined }) {
  const byDate = useQueries({
    queries: peak.as_of_dates.map((as_of) => ({
      queryKey: productKeys.resource("backtest/peak", { as_of }),
      queryFn: ({ signal }: { signal: AbortSignal }) => fetchEnvelope<PeakData>("backtest/peak", { as_of }, signal),
      staleTime: 5 * 60_000,
    })),
  });
  const forecast = useProductQuery<PeakForecastData>("forecasts/peak", undefined, { throwOnError: false });
  const variants = forecast.data?.data.variants ?? [];
  const variantLabel = (code: string) => variants.find((v) => v.variant === code)?.label ?? code;

  const loaded = byDate.every((q) => q.data);
  const rows = loaded ? modelRows(byDate.map((q) => (q.data as Envelope<PeakData>).data.cells), peak.scores) : [];
  const ours = rows.filter((r) => !r.benchmark);
  const benchmarks = rows.filter((r) => r.benchmark);
  const q = queue && queueSummary(queue);

  const backtested = rows.find((r) => r.source === MODEL)?.variants ?? [];
  const shownByDefault = variants.find((v) => v.is_default);
  const mismatch = shownByDefault && backtested.length > 0 && !backtested.includes(shownByDefault.variant);

  return (
    <SectionCard
      title="Models run"
      icon={Boxes}
      subtitle={meta.model_version ? <span className="font-mono">{meta.model_version}</span> : undefined}
      info="Each model rerun at every backtest date on the data it would have had then, scored against the actual summer peak. ERCOT's forecasts are the benchmarks."
    >
      {!loaded ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="space-y-3">
          <div className="grid-scrollbar overflow-x-auto rounded-lg border">
            <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className={th}>Model</th>
                  <th className={th}>Variant</th>
                  <th className={th}>Backtested</th>
                  <th className={cn(th, "text-right")}>Cells</th>
                  <th className={cn(th, "text-right")}>MAPE</th>
                  <th className={cn(th, "text-right")}>Bias</th>
                  <th className={cn(th, "text-right")}>Leaks</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <GroupRow label="Summer peak" />
                {ours.map((row) => (
                  <PeakRow key={row.source} row={row} variantLabel={variantLabel} />
                ))}
                {q && (
                  <>
                    <GroupRow label="Generation queue" />
                    <tr>
                      <th scope="row" className="px-3 py-2 text-left font-medium text-foreground">
                        Queue survival model
                      </th>
                      <td className="px-3 py-2 font-mono text-xs">{q.variants.join(", ") || GAP}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {q.months.length} {q.months.length === 1 ? "report" : "reports"}
                        {q.windowMonths ? ` · ${q.windowMonths}-month window` : ""}
                      </td>
                      <td className={num}>{formatWhole(q.rows)}</td>
                      <td className={num}>{formatPercent(q.meanAbsError)}</td>
                      <td className={num}>{formatPercent(q.meanError, { signed: true })}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{GAP}</td>
                    </tr>
                  </>
                )}
                {benchmarks.length > 0 && <GroupRow label="ERCOT benchmarks" />}
                {benchmarks.map((row) => (
                  <PeakRow key={row.source} row={row} variantLabel={variantLabel} />
                ))}
              </tbody>
            </table>
          </div>
          {mismatch && (
            <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                The <Link href="/forecast" className="underline underline-offset-2">forecast</Link> shows{" "}
                {shownByDefault.label} by default; the backtest scores {backtested.map(variantLabel).join(", ")}.
              </span>
            </p>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/** What a build fed on this screen, for its badge: the backtest marts, the forecast. */
const FEEDS: [string, string][] = [
  ["mart_peak_backtest", "Backtest"],
  ["mart_peak_forecast", "Forecast"],
];

/**
 * The model builds (mart builds, `stage = model`), newest first: the marts each wrote, the code it ran, its checks,
 * and a badge on the build behind the backtest and the forecast shown now. Each row opens the run as a notebook.
 */
function ModelBuilds() {
  const { runs, isPending, isError } = useModelRuns(20);
  // The build each mart on screen comes from now: its badge is lit, an older build's is grey.
  const current = new Map(FEEDS.map(([mart]) => [mart, runs ? runThatBuilt(runs, mart)?.runId : undefined]));
  return (
    <SectionCard
      title="Model builds"
      icon={History}
      subtitle={runs ? `${formatWhole(runs.length)} runs` : undefined}
      action={<CardOpenLink href="/ops?tab=pipelines" label="Open the pipelines" />}
    >
      {isPending ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !runs ? (
        <p className="text-sm text-muted-foreground">The run history could not be read.</p>
      ) : runs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No model build recorded.</p>
      ) : (
        <div className="grid-scrollbar overflow-x-auto rounded-lg border">
          <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
            <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className={th}>Run</th>
                <th className={th}>Marts</th>
                <th className={th}>Code</th>
                <th className={cn(th, "text-right")}>Checks</th>
                <th className={th}>Started</th>
                <th className={cn(th, "text-right")}>Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((r) => {
                const t = tally(r.checks);
                const feeds = FEEDS.filter(([mart]) => r.built.some((b) => b.mart === mart));
                return (
                  <tr key={r.runId} className="hover:bg-accent/60">
                    <td className="px-3 py-2">
                      <Link
                        href={`/backtest/runs/${encodeURIComponent(r.runId)}`}
                        className="inline-flex items-center gap-1.5 font-mono text-xs text-foreground hover:text-basecast-brand hover:underline"
                      >
                        <RunDot status={r.status} />
                        {shortRunId(r.runId)}
                      </Link>
                    </td>
                    <td className="max-w-80 px-3 py-2 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="truncate font-mono text-muted-foreground" title={r.marts.join(", ")}>
                          {r.marts.length === 1 ? r.marts[0] : `${r.marts.length} marts`}
                        </span>
                        {feeds.map(([mart, label]) => (
                          <AppBadge key={mart} state={current.get(mart) === r.runId ? "active" : "metadata"}>
                            {label}
                          </AppBadge>
                        ))}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.code ?? GAP}</td>
                    <td className={cn(num, "text-xs", t.failed > 0 && "text-red-600 dark:text-red-400")}>
                      {t.total ? `${t.passed}/${t.total}` : GAP}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{formatDateTime(r.startedAt)}</td>
                    <td className="px-3 py-2 text-right text-xs tabular-nums">{formatDuration(r.durationS)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

/** The Models tab: what ran in the backtest, then when the models were last built. */
export function ModelsBody({ peak, meta, queue }: { peak: PeakData; meta: Meta; queue: QueueData | undefined }) {
  return (
    <div className="space-y-4">
      <ModelsRun peak={peak} meta={meta} queue={queue} />
      <ModelBuilds />
    </div>
  );
}
