"use client";

import type * as React from "react";

import { AppBadge } from "@/components/components-app/ui/badge";
import { formatPercent, formatWhole, GAP } from "@/components/product/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import {
  comparisonsBySource,
  type Era,
  eraLabel,
  family,
  MODEL,
  ORGANIC,
  type PeakData,
  PRODUCT_NAME,
  type Score,
  scoresByEra,
  sourceLabel,
} from "./backtest-data";
import { useMode } from "./chart-bits";
import { type Mode, SERIES } from "./palette";
import { StatTile } from "./stat-tile";

const th = "py-2 pr-3 font-medium";
const num = "py-2 pr-3 text-right tabular-nums whitespace-nowrap";

function EraName({ era, eras }: { era: string; eras: Era[] }) {
  const description = eras.find((e) => e.era === era)?.description;
  const label = eraLabel(era, eras);
  if (!description) return <span className={cn(era === "all" && "font-medium text-foreground")}>{label}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4">
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{description}</TooltipContent>
    </Tooltip>
  );
}

function SourceName({ source }: { source: string }) {
  const name = PRODUCT_NAME[source];
  if (!name) return <>{sourceLabel(source)}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4">
          {sourceLabel(source)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">{name}</TooltipContent>
    </Tooltip>
  );
}

/** Two mean absolute errors as thin bars on one scale, values at the tips. */
function ErrorBars({ rows, max }: { rows: { key: string; value: number; color: string; label: string }[]; max: number }) {
  return (
    <div className="min-w-40 space-y-1">
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-2" title={`${row.label}: ${formatPercent(row.value)}`}>
          <div className="h-1.5 flex-1">
            <div
              className="h-full rounded-r-sm"
              style={{ width: `${max > 0 ? Math.max(2, (row.value / max) * 100) : 0}%`, backgroundColor: row.color }}
            />
          </div>
          <span className="w-11 text-right text-foreground tabular-nums">{formatPercent(row.value)}</span>
        </div>
      ))}
    </div>
  );
}

const colorOf = (source: string, mode: Mode) => SERIES[family(source)][mode];

/** basecast against each official source on the same cells, by era and over every date. */
function Comparisons({ data, mode }: { data: PeakData; mode: Mode }) {
  const groups = comparisonsBySource(data.comparisons, data.eras);
  const max = Math.max(0, ...data.comparisons.flatMap((c) => [c.basecast_mape, c.official_mape]));
  if (!groups.length) return <p className="text-sm text-muted-foreground">No paired cells.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className={cn(th, "text-left")}>Against</th>
            <th className={cn(th, "text-left")}>Era</th>
            <th className={cn(th, "text-right")}>Cells</th>
            <th className={cn(th, "text-left")}>Mean absolute error (basecast, then official)</th>
            <th className={cn(th, "text-right")}>Bias, basecast</th>
            <th className={cn(th, "text-right")}>Bias, official</th>
            <th className={cn(th, "text-left")}>Lower error</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([source, rows]) =>
            rows.map((row, i) => {
              const ours = row.basecast_mape < row.official_mape;
              const tie = row.basecast_mape === row.official_mape;
              return (
                <tr key={`${source}-${row.era}`} className={cn("border-border", i === rows.length - 1 && "border-b last:border-0")}>
                  {i === 0 && (
                    <td rowSpan={rows.length} className="py-2 pr-3 align-top font-medium whitespace-nowrap text-foreground">
                      <SourceName source={source} />
                    </td>
                  )}
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <EraName era={row.era} eras={data.eras} />
                  </td>
                  <td className={num}>{formatWhole(row.n)}</td>
                  <td className="py-2 pr-3">
                    <ErrorBars
                      max={max}
                      rows={[
                        { key: "basecast", value: row.basecast_mape, color: SERIES.basecast[mode], label: "basecast" },
                        { key: source, value: row.official_mape, color: colorOf(source, mode), label: sourceLabel(source) },
                      ]}
                    />
                  </td>
                  <td className={num}>{formatPercent(row.basecast_bias_pct, { signed: true })}</td>
                  <td className={num}>{formatPercent(row.official_bias_pct, { signed: true })}</td>
                  <td className="py-2 pr-3">
                    {tie ? (
                      <span className="text-muted-foreground">Tie</span>
                    ) : (
                      <AppBadge state={ours ? "active" : "metadata"}>{ours ? "basecast" : sourceLabel(source)}</AppBadge>
                    )}
                  </td>
                </tr>
              );
            }),
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Organic only against the full method, over every date. */
function Ablation({ data, meta }: { data: PeakData; meta: Meta }) {
  const organic = data.ablation.find((s) => s.source === ORGANIC);
  const full = data.ablation.find((s) => s.source === MODEL);
  if (!organic && !full) return <p className="text-sm text-muted-foreground">No ablation in this build.</p>;
  const fact = (score: Score | undefined) => ({
    value: score?.mape ?? null,
    unit: "%",
    label: score ? `${sourceLabel(score.source)}, mean absolute error (${eraLabel(score.era, data.eras).toLowerCase()})` : undefined,
    source: meta.sources?.join(", "),
    as_of: meta.data_as_of,
    simulated: meta.simulated,
  });
  const caption = (score: Score | undefined) =>
    score && (
      <>
        Bias {formatPercent(score.bias_pct, { signed: true })} · band coverage{" "}
        {score.coverage == null ? GAP : formatPercent(score.coverage, { ratio: true })} · {formatWhole(score.n)} cells
      </>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <StatTile label="Organic only: trend and weather, no large-load layer" fact={fact(organic)} caption={caption(organic)} />
      <StatTile label="Full method: plus the large-load and unattributed layers" fact={fact(full)} caption={caption(full)} />
    </div>
  );
}

/** Every source's score in every era. */
function AllScores({ data }: { data: PeakData }) {
  const groups = scoresByEra(data.scores, data.eras);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className={cn(th, "text-left")}>Era</th>
            <th className={cn(th, "text-left")}>Source</th>
            <th className={cn(th, "text-right")}>Cells</th>
            <th className={cn(th, "text-right")}>Mean absolute error</th>
            <th className={cn(th, "text-right")}>Bias</th>
            <th className={cn(th, "text-right")}>Band coverage</th>
          </tr>
        </thead>
        <tbody>
          {groups.map(([era, rows]) =>
            rows.map((row, i) => (
              <tr key={`${era}-${row.source}`} className={cn("border-border", i === rows.length - 1 && "border-b last:border-0")}>
                {i === 0 && (
                  <td rowSpan={rows.length} className="py-2 pr-3 align-top whitespace-nowrap">
                    <EraName era={era} eras={data.eras} />
                  </td>
                )}
                <td className={cn("py-2 pr-3", row.source === MODEL && "font-medium text-foreground")}>
                  <SourceName source={row.source} />
                </td>
                <td className={num}>{formatWhole(row.n)}</td>
                <td className={num}>{formatPercent(row.mape)}</td>
                <td className={num}>{formatPercent(row.bias_pct, { signed: true })}</td>
                <td className={num}>{row.coverage == null ? GAP : formatPercent(row.coverage, { ratio: true })}</td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
        {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * The scores over every backtest date: basecast against each official source on the same cells, split by
 * era (including the one where ERCOT did better), the ablation, and every source's own score.
 */
export function ScoresBody({ data, meta }: { data: PeakData; meta: Meta }) {
  const mode = useMode();
  return (
    <div className="space-y-6">
      <Section
        title="basecast against the official forecasts"
        note="Paired on the same cells (backtest date and target summer). Error = (forecast − actual) ÷ actual; a positive bias is a forecast that ran high."
      >
        <Comparisons data={data} mode={mode} />
      </Section>
      <Section title="Ablation" note="The same model without its large-load layer, over every date.">
        <Ablation data={data} meta={meta} />
      </Section>
      <Section title="Every source by era" note="Band coverage is the share of cells whose actual fell inside our P10–P90.">
        <AllScores data={data} />
      </Section>
    </div>
  );
}
