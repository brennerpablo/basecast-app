"use client";

import { History } from "lucide-react";

import { formatPercent } from "@/components/product/format";
import { KpiItem } from "@/components/product/kpi-item";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { backtestEdge } from "@/lib/home/highlights";
import { cn } from "@/lib/utils";

import { sourceLabel } from "../../backtest/_components/backtest-data";
import { HomeCard } from "./home-card";

type BacktestData = components["schemas"]["PeakBacktestData"];

/**
 * How far to trust the numbers: our peak model rerun at past dates against ERCOT's forecasts of the same
 * summers, paired on the same dates, era by era. The headline is the latest era; the table keeps the eras
 * where ERCOT did better.
 */
export function BacktestCard() {
  const query = useProductQuery<BacktestData>("backtest/peak", undefined, { throwOnError: false });
  return (
    <HomeCard<BacktestData>
      icon={History}
      title="How far to trust it"
      subtitle="Our peak model rerun at past dates, scored against ERCOT's own forecasts."
      href="/backtest"
      linkLabel="Open Backtest"
      query={query}
      isEmpty={(d) => d.comparisons.length === 0}
      empty={{ title: "No backtest scored yet" }}
      skeleton={<Skeleton className="h-80 w-full" />}
    >
      {(data) => {
        const { headline, rows } = backtestEdge(data);
        const eraLabel = new Map(data.eras.map((era) => [era.era, era.label]));
        return (
          <div className="space-y-5">
            {headline && (
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Mean absolute error · {eraLabel.get(headline.era) ?? headline.era} ({headline.n} dates)
                </p>
                <div className="mt-2 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl leading-none font-semibold tracking-[-0.01em] text-foreground tabular-nums">
                      {formatPercent(headline.basecast_mape)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">BaseCast</p>
                  </div>
                  <div>
                    <p className="text-3xl leading-none font-semibold tracking-[-0.01em] text-muted-foreground tabular-nums">
                      {formatPercent(headline.official_mape)}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">ERCOT, {sourceLabel(headline.official_source)}</p>
                  </div>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Against</th>
                    <th className="py-2 pr-3 text-right font-medium">Dates</th>
                    <th className="py-2 pr-3 text-right font-medium">Ours</th>
                    <th className="py-2 text-right font-medium">ERCOT</th>
                  </tr>
                </thead>
                {data.eras.map(({ era, label }) => {
                  const inEra = rows.filter((row) => row.era === era);
                  if (!inEra.length) return null;
                  return (
                    <tbody key={era} className="divide-y divide-border">
                      <tr>
                        <th colSpan={4} scope="colgroup" className="pt-3 pb-1 text-left text-xs font-medium text-muted-foreground">
                          {label}
                        </th>
                      </tr>
                      {inEra.map((row) => {
                        const oursBetter = row.basecast_mape < row.official_mape;
                        return (
                          <tr key={row.official_source}>
                            <td className="py-2 pr-3 whitespace-nowrap">{sourceLabel(row.official_source)}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{row.n}</td>
                            <td className={cn("py-2 pr-3 text-right tabular-nums", oursBetter && "font-semibold text-foreground")}>
                              {formatPercent(row.basecast_mape)}
                            </td>
                            <td className={cn("py-2 text-right tabular-nums", !oursBetter && "font-semibold text-foreground")}>
                              {formatPercent(row.official_mape)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  );
                })}
              </table>
              <p className="mt-2 text-xs text-muted-foreground">Mean absolute percent error on the same dates; the lower of each pair in bold.</p>
            </div>
            {data.ablation.length > 1 && (
              <div className="grid grid-cols-2 gap-4 border-t border-border pt-4">
                {data.ablation.map((score) => (
                  <KpiItem
                    key={score.source}
                    label={`Ablation: ${sourceLabel(score.source)}`}
                    value={`${formatPercent(score.mape)} MAPE`}
                  />
                ))}
              </div>
            )}
          </div>
        );
      }}
    </HomeCard>
  );
}
