"use client";

import { TrendingUp } from "lucide-react";
import { useMemo } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { formatPower, GAP } from "@/components/product/format";
import { KpiItem } from "@/components/product/kpi-item";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, gwTick, INK, SERIES } from "@/lib/charts/palette";
import { nextSummer, peakRows } from "@/lib/home/highlights";
import { useTheme } from "@/lib/hooks/use-theme";

import { HomeCard } from "./home-card";

type PeakData = components["schemas"]["PeakForecastData"];
type Row = ReturnType<typeof peakRows>[number];

const signedPower = (mw: number) => `${mw > 0 ? "+" : mw < 0 ? "−" : ""}${formatPower(Math.abs(mw))}`;

/** Our P50 with its band against ERCOT's adjusted line, year by year. */
function PeakMiniChart({ data, mode, officialLabel }: { data: PeakData; mode: ChartMode; officialLabel: string }) {
  const rows = useMemo(() => peakRows(data), [data]);
  const ink = INK[mode];
  const ours = SERIES[mode][0];
  return (
    <div className="space-y-2">
      <div className="h-60 w-full">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 12 }} />
            <YAxis
              tickFormatter={gwTick}
              tickLine={false}
              axisLine={false}
              width={64}
              domain={["auto", "auto"]}
              tick={{ fill: ink.muted, fontSize: 12 }}
            />
            <Tooltip
              cursor={{ stroke: ink.axis }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                return (
                  <ChartTooltipCard
                    title={`Summer ${label} peak`}
                    rows={[
                      { label: "Our P50", value: formatPower(row.p50), color: ours },
                      ...(row.band ? [{ label: "P10 – P90", value: `${formatPower(row.band[0])} – ${formatPower(row.band[1])}` }] : []),
                      { label: officialLabel, value: row.official == null ? GAP : formatPower(row.official), color: ink.secondary, dashed: true },
                    ]}
                  />
                );
              }}
            />
            <Area dataKey="band" stroke="none" fill={ours} fillOpacity={0.16} isAnimationActive={false} />
            <Line dataKey="p50" stroke={ours} strokeWidth={2} dot={{ r: 3, fill: ours, strokeWidth: 0 }} isAnimationActive={false} />
            <Line
              dataKey="official"
              stroke={ink.secondary}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3, fill: ink.secondary, strokeWidth: 0 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: ours }} />
          Our P50 and P10–P90
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4" style={{ borderTop: `2px dashed ${ink.secondary}` }} />
          {officialLabel}
        </span>
      </div>
    </div>
  );
}

/**
 * The next summer's ERCOT peak, as the Forecast screen's default variant forecasts it: P50, band and the gap
 * to ERCOT's adjusted line, then every forecast year against that line.
 */
export function ForecastCard() {
  const query = useProductQuery<PeakData>("forecasts/peak", undefined, { throwOnError: false });
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const data = query.data?.data;
  const variant = data?.variants.find((v) => v.variant === data.variant)?.label;
  return (
    <HomeCard<PeakData>
      icon={TrendingUp}
      title="Summer peak"
      subtitle={variant}
      href="/forecast"
      linkLabel="Open Forecast"
      query={query}
      isEmpty={(d) => !d.available || d.series.length === 0}
      empty={{ title: "No forecast yet" }}
      skeleton={<Skeleton className="h-80 w-full" />}
    >
      {(peak) => {
        const next = nextSummer(peak);
        if (!next) return null;
        const { point, official, gapMw } = next;
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs font-medium text-muted-foreground">Summer {point.target_year} peak, P50</p>
                <p className="mt-1 text-3xl leading-none font-semibold tracking-[-0.01em] text-foreground tabular-nums">
                  {formatPower(point.p50_mw)}
                </p>
                {point.p10_mw != null && point.p90_mw != null && (
                  <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                    P10–P90 {formatPower(point.p10_mw)} – {formatPower(point.p90_mw)}
                  </p>
                )}
              </div>
              <div className="col-span-2 grid grid-cols-2 content-start gap-4 sm:col-span-1 sm:grid-cols-1">
                <KpiItem label={official ? official.label : "ERCOT's line"} value={official ? formatPower(official.mw) : GAP} />
                <KpiItem label="Gap to ERCOT" value={gapMw == null ? GAP : signedPower(gapMw)} />
              </div>
            </div>
            <PeakMiniChart data={peak} mode={mode} officialLabel={official?.label ?? "ERCOT, adjusted"} />
          </div>
        );
      }}
    </HomeCard>
  );
}
