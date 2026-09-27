"use client";

import { Crosshair, Factory, Scale, Swords, Target } from "lucide-react";

import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { formatPercent, GAP } from "@/components/product/format";

import {
  BAND_TARGET,
  eraLabel,
  headToHead,
  MODEL,
  type PeakData,
  type QueueData,
  queueSummary,
  scoreOf,
  sourceLabel,
} from "./backtest-data";

/** The official products the peak model is measured against on the scorecard (their scores over every date). */
const BENCHMARKS = ["LTLF", "CDR"];

const rho = (value: number | null | undefined) => (value == null ? GAP : value.toFixed(2));

/**
 * How solid the models are, above the tabs: the peak model's error against ERCOT's, how often it beat them era
 * by era, its bias, whether its band holds what it claims, and whether the adjusted queue ranks counties better
 * than the raw one. A card turns orange where the model falls short.
 */
export function BacktestScorecard({
  peak,
  queue,
  loading,
}: {
  peak: PeakData | undefined;
  queue: QueueData | undefined;
  /** Still fetching; a response that failed or is being rebuilt shows its cards as gaps. */
  loading: { peak: boolean; queue: boolean };
}) {
  const ours = peak && scoreOf(peak.scores, MODEL);
  const benchmarks = peak
    ? BENCHMARKS.map((source) => ({ source, score: scoreOf(peak.scores, source) })).filter((b) => b.score)
    : [];
  const bestOfficial = Math.min(...benchmarks.map((b) => b.score!.mape));
  const duel = peak && headToHead(peak.comparisons, peak.eras);
  const q = queue && queueSummary(queue);
  const coverage = ours?.coverage;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-5">
      <DashboardStatCard
        layout="stacked"
        icon={<Target className="size-4" aria-hidden />}
        title="Peak MAPE"
        isLoading={loading.peak}
        isAlert={!!ours && benchmarks.length > 0 && ours.mape > bestOfficial}
        value={ours ? formatPercent(ours.mape) : GAP}
        hint={
          benchmarks.length
            ? benchmarks.map((b) => `${sourceLabel(b.source)} ${formatPercent(b.score!.mape)}`).join(" · ")
            : undefined
        }
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Swords className="size-4" aria-hidden />}
        title="Wins vs ERCOT"
        isLoading={loading.peak}
        isAlert={!!duel && duel.wins < duel.total}
        value={duel?.total ? `${duel.wins} of ${duel.total}` : GAP}
        hint={duel?.byEra.map((e) => `${eraLabel(e.era, peak!.eras)} ${e.wins}/${e.total}`).join(" · ")}
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Scale className="size-4" aria-hidden />}
        title="Bias"
        isLoading={loading.peak}
        value={ours ? formatPercent(ours.bias_pct, { signed: true }) : GAP}
        hint={
          ours
            ? [
                ours.bias_pct < 0 ? "Runs low" : "Runs high",
                ...benchmarks.map((b) => `${sourceLabel(b.source)} ${formatPercent(b.score!.bias_pct, { signed: true })}`),
              ].join(" · ")
            : undefined
        }
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Crosshair className="size-4" aria-hidden />}
        title="Band coverage"
        isLoading={loading.peak}
        isAlert={coverage != null && coverage < BAND_TARGET}
        value={formatPercent(coverage, { ratio: true })}
        hint={`Target ${formatPercent(BAND_TARGET, { ratio: true })} inside P10–P90`}
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Factory className="size-4" aria-hidden />}
        title="Queue rank ρ"
        isLoading={loading.queue}
        isAlert={q?.rank?.rho_adj != null && q.rank.rho_raw != null && q.rank.rho_adj <= q.rank.rho_raw}
        value={rho(q?.rank?.rho_adj)}
        hint={
          q
            ? [
                `Raw queue ${rho(q.rank?.rho_raw)}`,
                q.meanAbsError != null &&
                  `${q.windowMonths ? `${q.windowMonths}-month error` : "Error"} ${formatPercent(q.meanAbsError)}`,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />
    </div>
  );
}
