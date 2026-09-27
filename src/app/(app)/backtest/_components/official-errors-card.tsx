"use client";

import { Files, Target } from "lucide-react";

import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { formatDate, formatPercent, formatPower, formatWhole, GAP } from "@/components/product/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import {
  ERROR_BINS,
  errorBin,
  errorMatrix,
  inView,
  type OfficialError,
  type OfficialErrorsData,
  PRODUCT_NAME,
  sourceLabel,
} from "./backtest-data";
import { useMode } from "./chart-bits";
import { binFill, inkOn, type Mode } from "./palette";

/** The view a product picks: the one asked for when the API lists it, else LTLF, else the first. */
export function pickView(views: string[], asked: string | null): string | null {
  if (asked && views.includes(asked)) return asked;
  return views.includes("LTLF") ? "LTLF" : (views[0] ?? null);
}

function ErrorCell({ item, mode }: { item: OfficialError; mode: Mode }) {
  const bin = errorBin(item.error_pct);
  const fill = bin == null ? undefined : binFill(bin, mode);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <td
          tabIndex={0}
          className={cn(
            "h-7 min-w-14 cursor-default border-2 border-card px-1 text-center text-[11px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !item.actual_complete && "italic",
          )}
          style={fill ? { backgroundColor: fill, color: inkOn(fill) } : undefined}
        >
          {formatPercent(item.error_pct, { signed: true })}
        </td>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-0.5 text-xs">
        <p className="font-medium">
          {item.vintage} → summer {item.target_year}
        </p>
        <p>
          {item.horizon === 0 ? "Published inside that summer" : item.horizon === 1 ? "1 summer ahead" : `${item.horizon} summers ahead`}
        </p>
        <p>Forecast {formatPower(item.forecast_mw)}</p>
        <p>
          Actual {formatPower(item.actual_mw)}
          {!item.actual_complete && " (preliminary)"}
          {item.actual_peak_local && `, ${item.actual_peak_local}`}
        </p>
        <p>
          Error {formatPercent(item.error_pct, { signed: true })}
          {item.error_mw != null && ` (${item.error_mw >= 0 ? "+" : "-"}${formatPower(Math.abs(item.error_mw))})`}
        </p>
        {item.series && <p className="text-muted-foreground">Series: {item.series}</p>}
      </TooltipContent>
    </Tooltip>
  );
}

function ScaleLegend({ mode }: { mode: Mode }) {
  const [a, b, c] = ERROR_BINS;
  const steps: { bin: number; label: string }[] = [
    { bin: -3, label: `Under by ${c}%+` },
    { bin: -2, label: `${b}–${c}%` },
    { bin: -1, label: `${a}–${b}%` },
    { bin: 0, label: `Within ±${a}%` },
    { bin: 1, label: `${a}–${b}%` },
    { bin: 2, label: `${b}–${c}%` },
    { bin: 3, label: `Over by ${c}%+` },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Error scale">
      {steps.map((step) => (
        <li key={step.bin} className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm" style={{ backgroundColor: binFill(step.bin, mode) }} />
          {step.label}
        </li>
      ))}
    </ul>
  );
}

/** Mean absolute percent error, bias and vintage count by horizon, for the products in view. */
function HorizonSummaryTable({ data, view }: { data: OfficialErrorsData; view: string }) {
  const rows = data.summary.filter((s) => inView(s.product, view));
  const products = [...new Set(rows.map((r) => r.product))];
  const horizons = [...new Set(rows.map((r) => r.horizon))].sort((x, y) => x - y);
  if (!rows.length) return null;
  const at = (product: string, h: number) => rows.find((r) => r.product === product && r.horizon === h);
  const metrics: { key: string; label: string; value: (r: (typeof rows)[number]) => string }[] = [
    { key: "mape", label: "MAPE", value: (r) => formatPercent(r.mape) },
    { key: "bias", label: "Bias", value: (r) => formatPercent(r.bias_pct, { signed: true }) },
    { key: "n", label: "Vintages", value: (r) => formatWhole(r.n) },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 text-left font-medium">Summers ahead</th>
            <th className="py-2 pr-3 text-left font-medium" />
            {horizons.map((h) => (
              <th key={h} className="py-2 pr-3 text-right font-medium tabular-nums">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product) =>
            metrics.map((metric, i) => (
              <tr key={`${product}-${metric.key}`} className={cn("border-border", i === metrics.length - 1 && "border-b last:border-0")}>
                {i === 0 && (
                  <td rowSpan={metrics.length} className="py-1.5 pr-3 align-top font-medium whitespace-nowrap text-foreground">
                    {sourceLabel(product)}
                  </td>
                )}
                <td className="py-1.5 pr-3 whitespace-nowrap text-muted-foreground">{metric.label}</td>
                {horizons.map((h) => {
                  const r = at(product, h);
                  return (
                    <td key={h} className="py-1.5 pr-3 text-right whitespace-nowrap tabular-nums">
                      {r ? metric.value(r) : GAP}
                    </td>
                  );
                })}
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

/** The official product's error in four stat cards: 1, 3 and 5 summers ahead, and the vintages scored. */
export function OfficialStats({ data, view }: { data: OfficialErrorsData; view: string }) {
  const rows = data.summary.filter((s) => s.product === view);
  const at = (h: number) => rows.find((r) => r.horizon === h);
  const vintages = new Set(data.items.filter((i) => inView(i.product, view)).map((i) => `${i.product}-${i.vintage}`)).size;
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {[1, 3, 5].map((h) => {
        const r = at(h);
        return (
          <DashboardStatCard
            key={h}
            layout="stacked"
            icon={<Target className="size-4" aria-hidden />}
            title={`${sourceLabel(view)} MAPE, ${h} ${h === 1 ? "summer" : "summers"} ahead`}
            value={r ? formatPercent(r.mape) : GAP}
            hint={r ? `Bias ${formatPercent(r.bias_pct, { signed: true })} · ${formatWhole(r.n)} vintages` : "Not scored"}
          />
        );
      })}
      <DashboardStatCard
        layout="stacked"
        icon={<Files className="size-4" aria-hidden />}
        title="Vintages scored"
        value={formatWhole(vintages)}
      />
    </div>
  );
}

/**
 * Every official vintage against every summer it forecast (Q1): error in % of the actual, blue where the
 * forecast ran low, red where it ran high, and the summary by horizon below.
 */
export function OfficialErrorsBody({ data, meta, view }: { data: OfficialErrorsData; meta: Meta; view: string }) {
  const mode = useMode();
  const { rows, years } = errorMatrix(data.items, view);
  const preliminary = meta.caveats?.find((c) => c.code === "preliminary_actuals");
  const openYears = new Set(data.items.filter((i) => !i.actual_complete).map((i) => i.target_year));

  if (!rows.length) return <p className="text-sm text-muted-foreground">No vintage of {view} in this build.</p>;
  return (
    <div className="space-y-4">
      <ScaleLegend mode={mode} />
      <div className="max-h-112 overflow-auto rounded-md border border-border">
        <table className="w-full border-collapse text-xs">
          <thead className="sticky top-0 z-10 bg-card text-muted-foreground">
            <tr>
              <th className="sticky left-0 z-20 bg-card px-2 py-2 text-left font-medium">
                Vintage <span className="font-normal">→ target summer</span>
              </th>
              {years.map((year) => (
                <th key={year} className="px-1 py-2 text-center font-medium tabular-nums">
                  {openYears.has(year) && preliminary ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="cursor-help italic underline decoration-muted-foreground/40 decoration-dotted underline-offset-4">
                          {year}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        <p className="font-medium">{preliminary.label}</p>
                        <p>{preliminary.text}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    year
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.product}-${row.vintage}`}>
                <th scope="row" className="sticky left-0 z-1 bg-card px-2 py-1 text-left font-normal whitespace-nowrap">
                  <span className="text-foreground" title={PRODUCT_NAME[row.product]}>
                    {row.vintage}
                  </span>
                  <span className="ml-1.5 text-muted-foreground">{formatDate(row.vintageDate)}</span>
                </th>
                {years.map((year) => {
                  const item = row.byYear.get(year);
                  return item ? <ErrorCell key={year} item={item} mode={mode} /> : <td key={year} className="h-7 min-w-14" />;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <HorizonSummaryTable data={data} view={view} />
    </div>
  );
}
