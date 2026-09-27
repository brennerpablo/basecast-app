"use client";

import { parseAsString, useQueryStates } from "nuqs";
import { useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { VerifiedBadge } from "@/components/product/caveat-badges";
import { DataCard } from "@/components/product/data-card";
import { formatDate, formatPower, GAP } from "@/components/product/format";
import { SectionCard } from "@/components/product/section-card";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import type { Meta } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, gwTick, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

import { ChartTooltipCard } from "./chart-tooltip";

type PeakData = components["schemas"]["PeakForecastData"];

const LAYERS = ["organic", "large_load", "unattributed"] as const;
type LayerKey = (typeof LAYERS)[number];
const LAYER_LABEL: Record<LayerKey, string> = {
  organic: "Organic",
  large_load: "Large loads realized",
  unattributed: "Flat load, unattributed",
};

/** Official lines in ink, told apart by their dash: they are references, not our series. */
const OFFICIAL_DASH: Record<string, string> = { ercot_adjusted: "0", tsp_provided: "6 4", cdr: "2 3" };

const BAND_LABEL: Record<string, string> = { p10_p90: "P10–P90", allocation_range: "Allocation range" };

type Row = {
  year: number;
  organic?: number;
  large_load?: number;
  unattributed?: number;
  total: number;
  p10: number | null;
  p90: number | null;
  band?: [number, number];
  verified: boolean;
  [official: `official:${string}`]: number | undefined;
};

function buildRows(data: PeakData): { rows: Row[]; officials: { key: `official:${string}`; label: string; series: string }[] } {
  const officials = new Map<string, { key: `official:${string}`; label: string; series: string }>();
  const rows: Row[] = data.series.map((point) => ({
    year: point.target_year,
    total: point.p50_mw,
    p10: point.p10_mw ?? null,
    p90: point.p90_mw ?? null,
    band:
      point.band_kind && point.p10_mw != null && point.p90_mw != null
        ? [point.p50_mw - point.p10_mw, point.p90_mw - point.p50_mw]
        : undefined,
    verified: point.verified ?? true,
  }));
  const byYear = new Map(rows.map((r) => [r.year, r]));
  for (const layer of data.layers) {
    const row = byYear.get(layer.target_year);
    if (row) row[layer.layer as LayerKey] = layer.p50_mw;
  }
  for (const line of data.official) {
    const key = `official:${line.label}` as const;
    officials.set(key, { key, label: line.label, series: line.series });
    const row = byYear.get(line.target_year);
    if (row) row[key] = line.mw;
  }
  return { rows, officials: [...officials.values()] };
}

function PeakChart({ data, mode }: { data: PeakData; mode: ChartMode }) {
  const { rows, officials } = useMemo(() => buildRows(data), [data]);
  const ink = INK[mode];
  const colors = SERIES[mode];
  const bandKind = data.series.find((s) => s.band_kind)?.band_kind ?? null;
  const layerColor = (layer: LayerKey) => colors[LAYERS.indexOf(layer)];

  return (
    <div className="space-y-3">
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={ink.grid} />
            <XAxis dataKey="year" tickLine={false} axisLine={{ stroke: ink.axis }} tick={{ fill: ink.muted, fontSize: 12 }} />
            <YAxis
              tickFormatter={gwTick}
              tickLine={false}
              axisLine={false}
              width={64}
              tick={{ fill: ink.muted, fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: ink.grid, opacity: 0.4 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Row;
                return (
                  <ChartTooltipCard
                    title={`Summer ${label} peak`}
                    rows={[
                      ...LAYERS.map((layer) => ({ label: LAYER_LABEL[layer], value: formatPower(row[layer]), color: layerColor(layer) })),
                      { label: "Total P50", value: formatPower(row.total) },
                      ...(bandKind && row.p10 != null && row.p90 != null
                        ? [{ label: BAND_LABEL[bandKind] ?? "Band", value: `${formatPower(row.p10)} – ${formatPower(row.p90)}` }]
                        : []),
                      ...officials.map((o) => ({ label: o.label, value: formatPower(row[o.key]), color: ink.secondary, dashed: o.series !== "ercot_adjusted" })),
                    ]}
                  />
                );
              }}
            />
            {LAYERS.map((layer, i) => (
              <Bar
                key={layer}
                dataKey={layer}
                stackId="peak"
                fill={layerColor(layer)}
                stroke={mode === "light" ? "#fcfcfb" : "#1a1a19"}
                strokeWidth={1}
                radius={i === LAYERS.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              >
                {i === LAYERS.length - 1 && bandKind && (
                  <ErrorBar dataKey="band" width={10} strokeWidth={1.5} stroke={ink.primary} direction="y" />
                )}
              </Bar>
            ))}
            {officials.map((o) => (
              <Line
                key={o.key}
                dataKey={o.key}
                name={o.label}
                stroke={ink.secondary}
                strokeWidth={2}
                strokeDasharray={OFFICIAL_DASH[o.series] ?? "4 4"}
                dot={{ r: 3, fill: ink.secondary, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        {LAYERS.map((layer) => (
          <span key={layer} className="flex items-center gap-1.5">
            <span className="size-3 rounded-[3px]" style={{ background: layerColor(layer) }} />
            {LAYER_LABEL[layer]} (P50)
          </span>
        ))}
        {bandKind && (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-px bg-foreground" />
            Total {BAND_LABEL[bandKind] ?? "band"}
          </span>
        )}
        {officials.map((o) => (
          <span key={o.key} className="flex items-center gap-1.5">
            <svg width="22" height="6" aria-hidden>
              <line x1="0" y1="3" x2="22" y2="3" stroke={ink.secondary} strokeWidth="2" strokeDasharray={OFFICIAL_DASH[o.series] ?? "4 4"} />
            </svg>
            {o.label}
          </span>
        ))}
      </div>
      <PeakTable rows={rows} officials={officials} bandKind={bandKind} />
    </div>
  );
}

/** The chart's numbers as a table: every value readable without the chart. */
function PeakTable({
  rows,
  officials,
  bandKind,
}: {
  rows: Row[];
  officials: { key: `official:${string}`; label: string }[];
  bandKind: string | null;
}) {
  // One badge for the table when every row was machine-read; per row when only some were.
  const allUnverified = rows.length > 0 && rows.every((r) => !r.verified);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className="py-2 pr-3 text-left font-medium">Summer</th>
            {LAYERS.map((layer) => (
              <th key={layer} className="py-2 pr-3 text-right font-medium">
                {LAYER_LABEL[layer]}
              </th>
            ))}
            <th className="py-2 pr-3 text-right font-medium">Total P50</th>
            {bandKind && <th className="py-2 pr-3 text-right font-medium">{BAND_LABEL[bandKind] ?? "Band"}</th>}
            {officials.map((o) => (
              <th key={o.key} className="py-2 pr-3 text-right font-medium">
                {o.label}
              </th>
            ))}
            <th className="py-2 font-medium">{allUnverified && <VerifiedBadge verified={false} />}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year} className="border-b border-border last:border-0">
              <td className="py-2 pr-3 tabular-nums">{row.year}</td>
              {LAYERS.map((layer) => (
                <td key={layer} className="py-2 pr-3 text-right tabular-nums">
                  {formatPower(row[layer])}
                </td>
              ))}
              <td className="py-2 pr-3 text-right font-medium tabular-nums">{formatPower(row.total)}</td>
              {bandKind && (
                <td className="py-2 pr-3 text-right whitespace-nowrap tabular-nums">
                  {row.p10 != null && row.p90 != null ? `${formatPower(row.p10)} – ${formatPower(row.p90)}` : GAP}
                </td>
              )}
              {officials.map((o) => (
                <td key={o.key} className="py-2 pr-3 text-right tabular-nums">
                  {formatPower(row[o.key])}
                </td>
              ))}
              <td className="py-2">{!allUnverified && <VerifiedBadge verified={row.verified} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** What drives the large-load layer: the deck, the factor, the realization ratio and the approved stock. */
function InputsCard({ data, meta }: { data: PeakData; meta: Meta }) {
  const i = data.inputs;
  const fields: [string, string][] = [
    ["Deck", formatDate(i.deck_vintage)],
    ["Factor", i.factor == null ? GAP : i.factor.toFixed(2)],
    [
      "Realization ratio P10 / P50 / P90",
      [i.ratio_p10, i.ratio_p50, i.ratio_p90].map((r) => (r == null ? GAP : r.toFixed(2))).join(" / "),
    ],
    ["Approved stock", formatPower(i.approved_stock_mw)],
  ];
  if (i.share_of_ll_u != null) fields.push(["Zone share of large loads", `${(i.share_of_ll_u * 100).toFixed(1)}%`]);
  return (
    <SectionCard title="Inputs of the large-load layer" action={<VerifiedBadge verified={i.verified} />} meta={meta}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4 xl:grid-cols-5">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  );
}

const peakParsers = { variant: parseAsString, region: parseAsString.withDefault("ERCOT") };

/** The Peak tab: the summer peak in three layers against ERCOT's official lines, by variant and region. */
export function PeakTab() {
  const [{ variant, region }, setState] = useQueryStates(peakParsers);
  const { resolvedTheme } = useTheme();
  const mode: ChartMode = resolvedTheme === "dark" ? "dark" : "light";
  const query = useProductQuery<PeakData>(
    "forecasts/peak",
    { region: region === "ERCOT" ? undefined : region, variant: variant ?? undefined },
    { keepPrevious: true },
  );
  const data = query.data?.data;
  const current = data?.variants.find((v) => v.variant === data.variant) ?? data?.variants.find((v) => v.is_default);
  const regions = current?.regions ?? data?.regions ?? [];

  const controls = data && (
    <div className="flex flex-wrap items-center gap-2">
      <SegmentedControl
        label="Variant"
        options={data.variants.map((v) => ({ value: v.variant, label: v.label }))}
        value={data.variant}
        onChange={(next) => {
          const option = data.variants.find((v) => v.variant === next);
          void setState({
            variant: option?.is_default ? null : next,
            // A variant that does not cover the current region falls back to ERCOT.
            region: option && !(option.regions as string[]).includes(region) ? null : region === "ERCOT" ? null : region,
          });
        }}
      />
      <SegmentedControl
        label="Region"
        options={regions.map((r) => ({ value: r, label: r }))}
        value={data.region}
        onChange={(next) => void setState({ region: next === "ERCOT" ? null : next })}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      {controls}
      <DataCard<PeakData>
        title={data ? `Summer peak, ${data.region === "ERCOT" ? "ERCOT" : `${data.region} weather zone`}` : "Summer peak"}
        subtitle={current ? `${current.label}${current.is_default ? " (default)" : ""} · run of ${formatDate(data?.as_of)}` : undefined}
        query={query}
        isEmpty={(d) => !d.available || d.series.length === 0}
        empty={{ title: "Not available for this region", description: "This variant is built for ERCOT only; pick the default variant for a zone." }}
        skeleton={<Skeleton className="h-96 w-full" />}
      >
        {(d) => <PeakChart data={d} mode={mode} />}
      </DataCard>
      {query.data?.data.available && <InputsCard data={query.data.data} meta={query.data.meta} />}
    </div>
  );
}
