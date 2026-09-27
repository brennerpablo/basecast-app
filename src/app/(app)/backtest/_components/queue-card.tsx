"use client";

import { AppBadge } from "@/components/components-app/ui/badge";
import { formatDate, formatNumber, formatPercent, formatPower, GAP } from "@/components/product/format";
import { InfoTip } from "@/components/product/info-tip";
import { cn } from "@/lib/utils";

import { type QueueData, queueLayout, type QueueRow, stratumLabel } from "./backtest-data";
import { ChartLegend, type LegendItem, useMode } from "./chart-bits";
import { ACTUAL, CONTEXT, type Mode, SERIES } from "./palette";

const month = (reportMonth: string) => formatDate(reportMonth.slice(0, 7));

type Measure = { key: string; label: string; value: (row: QueueRow) => number | null | undefined; color: (mode: Mode) => string };

const MEASURES: Measure[] = [
  { key: "raw", label: "Raw generation queue", value: (r) => r.raw_mw, color: (m) => CONTEXT[m][0] },
  { key: "developer", label: "Developer CODs", value: (r) => r.developer_projected_mw, color: (m) => CONTEXT[m][1] },
  { key: "pred", label: "basecast predicted", value: (r) => r.pred_mw, color: (m) => SERIES.basecast[m] },
  { key: "actual", label: "Built", value: (r) => r.actual_mw, color: (m) => ACTUAL[m] },
];

/** One queue snapshot: four bars on the card's shared scale, the value at each tip. */
function Snapshot({ row, max, mode }: { row: QueueRow; max: number; mode: Mode }) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-foreground">Queue of {month(row.report_month)}</p>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Predicted vs built
          <AppBadge state="metadata" className="tabular-nums">
            {formatPercent(row.error_pct, { signed: true })}
          </AppBadge>
        </span>
      </div>
      <dl className="space-y-1.5">
        {MEASURES.map((measure) => {
          const value = measure.value(row);
          const width = value != null && max > 0 ? Math.max(0.5, (value / max) * 100) : 0;
          return (
            <div key={measure.key} className="grid grid-cols-[9.5rem_1fr] items-center gap-2 text-xs">
              <dt className={cn("truncate text-muted-foreground", measure.key === "pred" && "font-medium text-foreground")}>
                {measure.label}
              </dt>
              <dd className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 min-w-0 rounded-r" style={{ width: `${width}%`, backgroundColor: measure.color(mode) }} />
                <span className="shrink-0 text-foreground tabular-nums">{formatPower(value)}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** Predicted against built by fuel, snapshot by snapshot. */
function ByStratum({ items, months, strata }: { items: QueueRow[]; months: string[]; strata: string[] }) {
  const at = (stratum: string, m: string) => items.find((i) => i.stratum === stratum && i.report_month === m);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 text-left font-medium">Stratum</th>
            {months.map((m) => (
              <th key={m} className="py-2 pr-3 text-right font-medium whitespace-nowrap">
                Queue of {month(m)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {strata.map((stratum) => (
            <tr key={stratum} className="border-b border-border last:border-0">
              <td className={cn("py-2 pr-3", stratum === "all" && "font-medium text-foreground")}>{stratumLabel(stratum)}</td>
              {months.map((m) => {
                const row = at(stratum, m);
                return (
                  <td key={m} className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                    {row ? (
                      <>
                        {formatPower(row.pred_mw)} <span className="text-muted-foreground">vs</span> {formatPower(row.actual_mw)}
                        <span className="block text-muted-foreground">{formatPercent(row.error_pct, { signed: true })}</span>
                      </>
                    ) : (
                      GAP
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** How well each ranking of counties matched what was built (Spearman), snapshot by snapshot. */
function CountyRanks({ data }: { data: QueueData }) {
  const rows = [...data.county_rank].sort((a, b) => a.report_month.localeCompare(b.report_month));
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 text-left font-medium">Queue of</th>
            <th className="py-2 pr-3 text-right font-medium">basecast adjusted</th>
            <th className="py-2 pr-3 text-right font-medium">Developers&apos; dates</th>
            <th className="py-2 pr-3 text-right font-medium">Raw queue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.report_month} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 whitespace-nowrap">{month(row.report_month)}</td>
              <td className="py-2 pr-3 text-right font-medium text-foreground tabular-nums">{formatNumber(row.rho_adj)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(row.rho_developer)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{formatNumber(row.rho_raw)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The generation-queue model rerun on past queue reports (X2): what it predicted would reach commercial
 * operation within the window, against what was built, the raw queue and the developers' own dates.
 */
export function QueueBody({ data }: { data: QueueData }) {
  const mode = useMode();
  const { months, strata } = queueLayout(data.items);
  const statewide = months.map((m) => data.items.find((i) => i.report_month === m && i.stratum === "all")).filter((r): r is QueueRow => !!r);
  const max = Math.max(0, ...statewide.flatMap((r) => MEASURES.map((m) => m.value(r) ?? 0)));
  const windows = [...new Set(data.items.map((i) => i.window_months))];
  const variants = [...new Set(data.items.map((i) => i.model_variant).filter(Boolean))];
  const legend: LegendItem[] = MEASURES.map((m) => ({ key: m.key, label: m.label, swatch: "rect", color: m.color(mode) }));

  return (
    <div className="space-y-6">
      <section className="min-w-0 space-y-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>MW in operation within {windows.length === 1 ? `${windows[0]} months` : "the window"} of report</span>
            {variants.length === 1 && (
              <AppBadge state="metadata" className="font-mono">
                {variants[0]}
              </AppBadge>
            )}
          </div>
          <ChartLegend items={legend} />
        </div>
        {statewide.length ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {statewide.map((row) => (
              <Snapshot key={row.report_month} row={row} max={max} mode={mode} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No statewide row in this build.</p>
        )}
      </section>
      <div className="grid gap-6 xl:grid-cols-5">
        <section className="min-w-0 space-y-2 xl:col-span-3">
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Predicted vs built, by stratum</h3>
          <ByStratum items={data.items} months={months} strata={strata} />
        </section>
        <section className="min-w-0 space-y-2 xl:col-span-2">
          <h3 className="flex items-center gap-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            County rank vs built · Spearman <span className="normal-case">ρ</span>
            <InfoTip label="About Spearman ρ">Rank correlation across counties; 1 = same order</InfoTip>
          </h3>
          <CountyRanks data={data} />
        </section>
      </div>
    </div>
  );
}
