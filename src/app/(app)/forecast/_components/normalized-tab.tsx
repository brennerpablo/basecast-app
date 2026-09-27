"use client";

import { parseAsString, useQueryStates } from "nuqs";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { DataCard } from "@/components/product/data-card";
import { formatDate, formatPercent, formatPower, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, gwTick, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

type Normalized = components["schemas"]["NormalizedLoadData"];

const MONTH = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "numeric" });
const monthLabel = (iso: string) => MONTH.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
const yearTick = (iso: string) => iso.slice(0, 4);

/** Weather-normalized load (X12): the monthly average, actual against normal weather, and the summer peak. */
export function NormalizedTab() {
  const [{ region }, setState] = useQueryStates({ region: parseAsString.withDefault("ERCOT") });
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const query = useProductQuery<Normalized>("load/normalized", { region: region === "ERCOT" ? undefined : region }, { keepPrevious: true });
  const data = query.data?.data;
  const ink = INK[mode];
  const [actualColor, normalColor] = SERIES[mode];

  return (
    <div className="space-y-4">
      {data && (
        <SegmentedControl
          label="Region"
          options={data.regions.map((r) => ({ value: r, label: r }))}
          value={data.region}
          onChange={(next) => void setState({ region: next === "ERCOT" ? null : next })}
        />
      )}
      <DataCard<Normalized>
        title={`Load, actual and at normal weather · ${data?.region ?? region}`}
        subtitle={data ? `Monthly average load. Normal weather: ${data.normal_period}; weather from ${data.weather_source}.` : undefined}
        query={query}
        isEmpty={(d) => d.monthly.length === 0}
        skeleton={<Skeleton className="h-80 w-full" />}
      >
        {(d) => (
          <div className="space-y-3">
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <LineChart data={d.monthly} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
                  <CartesianGrid vertical={false} stroke={ink.grid} />
                  <XAxis dataKey="month" tickFormatter={yearTick} tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 11 }} minTickGap={32} />
                  <YAxis tickFormatter={gwTick} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tick={{ fill: ink.muted, fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const m = payload[0].payload as Normalized["monthly"][number];
                      return (
                        <ChartTooltipCard
                          title={`${monthLabel(m.month)}${m.complete ? "" : " (month in progress)"}`}
                          rows={[
                            { label: "Average load", value: formatPower(m.avg_mw), color: actualColor },
                            { label: "At normal weather", value: formatPower(m.avg_norm_mw), color: normalColor },
                            { label: "Peak / at normal weather", value: `${formatPower(m.peak_mw)} / ${formatPower(m.peak_norm_mw)}` },
                            { label: "Normalized, vs a year before", value: m.yoy_norm_pct == null ? GAP : formatPercent(m.yoy_norm_pct, { signed: true }) },
                          ]}
                        />
                      );
                    }}
                  />
                  <Line dataKey="avg_mw" stroke={actualColor} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                  <Line dataKey="avg_norm_mw" stroke={normalColor} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4" style={{ background: actualColor }} /> Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4" style={{ background: normalColor }} /> At normal weather
              </span>
            </div>
          </div>
        )}
      </DataCard>
      {query.data && query.data.data.annual.length > 0 && <AnnualPeak data={query.data.data} meta={query.data.meta} mode={mode} />}
    </div>
  );
}

/** The summer peak each year against the range normal weather would give (P10–P90), and the yearly change. */
function AnnualPeak({ data, meta, mode }: { data: Normalized; meta: components["schemas"]["Meta"]; mode: ChartMode }) {
  const ink = INK[mode];
  const [actualColor, normalColor] = SERIES[mode];
  const rows = data.annual.map((y, i) => {
    const before = data.annual[i - 1];
    return {
      ...y,
      band: y.summer_peak_norm_p10 != null && y.summer_peak_norm_p90 != null ? [y.summer_peak_norm_p10, y.summer_peak_norm_p90] : null,
      raw_yoy: before?.energy_gwh && y.energy_gwh != null ? ((y.energy_gwh - before.energy_gwh) / before.energy_gwh) * 100 : null,
    };
  });
  return (
    <SectionCard title="Summer peak against normal weather" subtitle="Each summer's actual peak and the P10–P90 range of peaks under the normal-weather years." meta={meta}>
      <div className="h-72 w-full">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 12 }} />
            <YAxis tickFormatter={gwTick} tickLine={false} axisLine={false} width={56} domain={["auto", "auto"]} tick={{ fill: ink.muted, fontSize: 12 }} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const y = payload[0].payload as (typeof rows)[number];
                return (
                  <ChartTooltipCard
                    title={`Summer ${y.year}`}
                    rows={[
                      { label: "Actual peak", value: formatPower(y.summer_peak_mw), color: actualColor },
                      { label: "Normal-weather P50", value: formatPower(y.summer_peak_norm_p50), color: normalColor },
                      {
                        label: "Normal-weather P10–P90",
                        value: y.band ? `${formatPower(y.band[0])} – ${formatPower(y.band[1])}` : GAP,
                      },
                    ]}
                  />
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill={normalColor} fillOpacity={0.18} isAnimationActive={false} />
            <Line dataKey="summer_peak_norm_p50" stroke={normalColor} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Scatter dataKey="summer_peak_mw" fill={actualColor} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ background: actualColor }} /> Actual summer peak
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4" style={{ background: normalColor }} /> Normal-weather P50
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-[2px]" style={{ background: normalColor, opacity: 0.18 }} /> P10–P90
        </span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-1.5 pr-3 text-left font-medium">Year</th>
              <th className="py-1.5 pr-3 text-right font-medium">Energy, actual vs year before</th>
              <th className="py-1.5 pr-3 text-right font-medium">Energy at normal weather vs year before</th>
              <th className="py-1.5 text-right font-medium">Complete through</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((y) => (
              <tr key={y.year} className="border-b border-border last:border-0">
                <td className="py-1.5 pr-3 tabular-nums">{y.year}</td>
                <td className="py-1.5 pr-3 text-right tabular-nums">{formatPercent(y.raw_yoy, { signed: true })}</td>
                <td className="py-1.5 pr-3 text-right font-medium tabular-nums">{formatPercent(y.yoy_norm_pct, { signed: true })}</td>
                <td className="py-1.5 text-right tabular-nums">{formatDate(y.complete_through)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
