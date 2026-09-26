"use client";

import { formatDate, formatValue, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { AccountDetail } from "@/lib/accounts/labels";
import type { Caveat, Meta } from "@/lib/bff/envelope";

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
 * Why they rank here: each signal's value and percentile, its configured and used weight (renormalized when
 * a signal is missing) and its contribution; the contributions sum to the score the API sends.
 */
export function ScoreCard({
  account,
  meta,
  caveats,
  className,
}: {
  account: AccountDetail;
  meta: Meta;
  caveats?: Caveat[];
  className?: string;
}) {
  const { score } = account;
  return (
    <SectionCard title="Score breakdown" subtitle={score.method} caveats={caveats} meta={meta} className={className}>
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
