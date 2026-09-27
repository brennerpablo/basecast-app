"use client";

import { Check, Gauge, Layers, ListChecks, Minus, Scale, Table2, Trophy } from "lucide-react";

import { AppBadge } from "@/components/components-app/ui/badge";
import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { formatDate, formatValue, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AccountDetail } from "@/lib/accounts/labels";
import type { Caveat } from "@/lib/bff/envelope";

const two = (value: number) => value.toFixed(2);

/** The percentile within the scored universe (0–1) as a bar on that fixed scale. */
function PercentileBar({ pct }: { pct: number | null | undefined }) {
  if (pct === null || pct === undefined) return <span className="text-muted-foreground">{GAP}</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden>
        <span className="block h-full rounded-full bg-basecast-brand" style={{ width: `${Math.min(1, Math.max(0, pct)) * 100}%` }} />
      </span>
      <span className="tabular-nums">{two(pct)}</span>
    </span>
  );
}

/**
 * The signals as a table: each one's value and percentile, its configured and used weight (renormalized when
 * a signal is missing) and its contribution; the contributions sum to the score the API sends.
 */
function SignalsCard({
  account,
  caveats,
  className,
}: {
  account: AccountDetail;
  caveats?: Caveat[];
  className?: string;
}) {
  const { score } = account;
  return (
    <SectionCard title="Signals" icon={Table2} subtitle={score.method} caveats={caveats} className={className}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 pr-3 font-medium">Signal</th>
              <th className="py-2 pr-3 text-right font-medium">Value</th>
              <th className="py-2 pr-3 font-medium">Percentile</th>
              <th className="py-2 pr-3 text-right font-medium">Weight</th>
              <th className="py-2 text-right font-medium">Contribution</th>
            </tr>
          </thead>
          <tbody>
            {score.signals.map((signal) => (
              <tr key={signal.signal} className="border-b border-border">
                <td className="py-2 pr-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0} className="cursor-help underline decoration-muted-foreground/40 decoration-dotted underline-offset-4">
                        {signal.label}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">
                      Source: {signal.source} · as of {formatDate(signal.as_of)}
                    </TooltipContent>
                  </Tooltip>
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">{formatValue(signal.raw, signal.unit)}</td>
                <td className="py-2 pr-3">
                  <PercentileBar pct={signal.pct} />
                </td>
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                  {two(signal.weight)}
                  {Math.abs(signal.weight_used - signal.weight) > 1e-9 && (
                    <span className="text-muted-foreground" title="Renormalized: a signal is missing">
                      {" "}
                      → {two(signal.weight_used)}
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-medium tabular-nums">{signal.contribution.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="pt-2 font-medium" colSpan={4}>
                Score · rank {score.rank} of {score.n_accounts} · tier {score.tier}
                {score.weights_set && <span className="font-normal text-muted-foreground"> · weights {score.weights_set}</span>}
              </td>
              <td className="pt-2 text-right font-semibold tabular-nums">{score.score.toFixed(3)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </SectionCard>
  );
}

function Covered({ on, label, off }: { on: boolean; label: string; off: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {on ? <Check className="size-4 text-basecast-brand" aria-hidden /> : <Minus className="size-4 text-muted-foreground" aria-hidden />}
      <span>{label}</span>
      {!on && <span className="text-xs text-muted-foreground">{off}</span>}
    </li>
  );
}

/** What the diagnosis could not fill (`gaps`) and which data it stands on (`coverage`). */
function GapsCard({ account, className }: { account: AccountDetail; className?: string }) {
  const gaps = account.gaps ?? [];
  const coverage = account.coverage;
  return (
    <SectionCard title="Data gaps and coverage" icon={ListChecks} className={className}>
      <div className="space-y-4">
        {gaps.length ? (
          <ul className="space-y-2">
            {gaps.map((gap) => (
              <li key={`${gap.key}-${gap.kind}`} className="flex items-start gap-2 text-sm">
                <AppBadge state={gap.kind === "missing" ? "alert" : "meta"} className="mt-0.5 shrink-0">
                  {gap.kind.replaceAll("_", " ")}
                </AppBadge>
                <span>{gap.detail}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No gap reported.</p>
        )}
        {coverage && (
          <div>
            <p className="mb-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Coverage · resolution {coverage.resolution}
            </p>
            <ul className="space-y-1">
              <Covered on={coverage.public_data ?? true} label="Public data" off="" />
              <Covered on={coverage.utility_private_data ?? false} label="The co-op's own data" off="UtilityDataSource, not connected" />
              <Covered on={coverage.fleet_data ?? false} label="Base's fleet" off="FleetDataSource, not connected" />
            </ul>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

/**
 * Each signal's share of the score as a bar: the track is the weight it carries (the most it can add), the
 * fill its contribution, so the filled fraction is the account's percentile. The fills add up to the score.
 */
function ContributionsCard({ account, className }: { account: AccountDetail; className?: string }) {
  const { score } = account;
  const signals = [...score.signals].sort((a, b) => b.contribution - a.contribution);
  const maxWeight = Math.max(...signals.map((s) => s.weight_used), 0.0001);
  return (
    <SectionCard
      title="What makes the score"
      icon={Gauge}
      subtitle="Each bar's track is the signal's weight; the fill is what it adds (percentile × weight)."
      className={className}
    >
      <ul className="space-y-3">
        {signals.map((signal) => (
          <li key={signal.signal} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 sm:grid-cols-[14rem_minmax(0,1fr)_auto]">
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="cursor-help truncate text-sm">
                  {signal.label}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs space-y-0.5 text-xs">
                <p className="font-medium">{signal.label}</p>
                <p>
                  Value {formatValue(signal.raw, signal.unit)} · percentile {signal.pct == null ? GAP : two(signal.pct)}
                </p>
                <p className="text-muted-foreground">
                  Source: {signal.source} · as of {formatDate(signal.as_of)}
                </p>
              </TooltipContent>
            </Tooltip>
            <span
              className="relative order-last col-span-2 h-2.5 rounded-full bg-muted sm:order-0 sm:col-span-1"
              style={{ width: `${(signal.weight_used / maxWeight) * 100}%` }}
              aria-hidden
            >
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-basecast-brand"
                style={{ width: `${signal.weight_used > 0 ? Math.min(1, signal.contribution / signal.weight_used) * 100 : 0}%` }}
              />
            </span>
            <span className="text-right text-sm tabular-nums">
              <span className="font-semibold">{signal.contribution.toFixed(3)}</span>
              <span className="text-muted-foreground"> / {two(signal.weight_used)}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="font-medium">Score</span>
        <span className="font-semibold tabular-nums">{score.score.toFixed(3)}</span>
      </div>
    </SectionCard>
  );
}

/** The score in four numbers: the score, the rank, the tier and the weights it was built with. */
function ScoreStats({ account }: { account: AccountDetail }) {
  const { score } = account;
  const pending = score.weights_status === "pending_review";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <DashboardStatCard layout="stacked" icon={<Gauge className="size-4" aria-hidden />} title="Score" value={two(score.score)} hint="Of 1.00, from percentiles in the universe" />
      <DashboardStatCard
        layout="stacked"
        icon={<Trophy className="size-4" aria-hidden />}
        title="Rank"
        value={`${score.rank} of ${score.n_accounts}`}
        hint={
          score.rank_within_type != null
            ? `#${score.rank_within_type} among ${account.account_type === "muni" ? "munis" : "co-ops"}`
            : "Across co-ops and munis"
        }
      />
      <DashboardStatCard layout="stacked" icon={<Layers className="size-4" aria-hidden />} title="Tier" value={score.tier} />
      <DashboardStatCard
        layout="stacked"
        icon={<Scale className="size-4" aria-hidden />}
        title="Weights"
        value={score.weights_set ?? GAP}
        hint={score.weights_status ? score.weights_status.replaceAll("_", " ") : undefined}
        isAlert={pending}
      />
    </div>
  );
}

/** Score: the four numbers, what makes the score beside the data gaps, and the signals as a table. */
export function ScoreTab({ account, caveats }: { account: AccountDetail; caveats?: Caveat[] }) {
  return (
    <div className="space-y-4">
      <ScoreStats account={account} />
      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <ContributionsCard account={account} className="lg:col-span-2" />
        <GapsCard account={account} />
      </div>
      <SignalsCard account={account} caveats={caveats} />
    </div>
  );
}
