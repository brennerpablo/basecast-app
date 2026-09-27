"use client";

import { CalendarDays, Landmark, MapPin, Percent, Ruler, Server, Sigma, SlidersHorizontal, Table2, TrendingUp } from "lucide-react";
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
import { ChartTooltipCard } from "@/components/product/chart-tooltip";
import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { QueryBody } from "@/components/product/data-card";
import { Filter, FilterRow } from "@/components/product/filter";
import { formatDate, formatPower, GAP } from "@/components/product/format";
import { KpiItem } from "@/components/product/kpi-item";
import { Provenance } from "@/components/product/provenance";
import { SectionCard } from "@/components/product/section-card";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { type ChartMode, gwTick, INK, SERIES } from "@/lib/charts/palette";
import { useTheme } from "@/lib/hooks/use-theme";

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
      <div className="space-y-1.5 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <span className="w-24 shrink-0 font-medium text-foreground/80">Our forecast</span>
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
        </div>
        {officials.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
            <span className="w-24 shrink-0 font-medium text-foreground/80">ERCOT&apos;s lines</span>
            {officials.map((o) => (
              <span key={o.key} className="flex items-center gap-1.5">
                <svg width="22" height="6" aria-hidden>
                  <line x1="0" y1="3" x2="22" y2="3" stroke={ink.secondary} strokeWidth="2" strokeDasharray={OFFICIAL_DASH[o.series] ?? "4 4"} />
                </svg>
                {o.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** What each band is made of, in the API's words, for the bases this view uses. */
function BandBasis({ data }: { data: PeakData }) {
  const texts = data.band_basis ?? {};
  const used = [...new Set([...data.series, ...data.layers].map((p) => p.band_basis).filter((b): b is string => Boolean(b)))];
  const lines = used.filter((code) => texts[code]);
  if (!lines.length) return null;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground/80">What the bands are made of</summary>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {lines.map((code) => (
          <li key={code}>{texts[code]}</li>
        ))}
      </ul>
    </details>
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
      <table className="w-full text-xs whitespace-nowrap">
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
function InputsCard({ data }: { data: PeakData }) {
  const i = data.inputs;
  return (
    <SectionCard
      title="Inputs of the large-load layer"
      icon={SlidersHorizontal}
      subtitle="The deck, factor and realization ratio the layer is built from."
      action={<VerifiedBadge verified={i.verified} />}
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiItem icon={CalendarDays} label="Deck" value={formatDate(i.deck_vintage)} />
        <KpiItem icon={Sigma} label="Factor" value={i.factor == null ? GAP : i.factor.toFixed(2)} />
        <KpiItem
          icon={Percent}
          label="Realization ratio P10 / P50 / P90"
          value={[i.ratio_p10, i.ratio_p50, i.ratio_p90].map((r) => (r == null ? GAP : r.toFixed(2))).join(" / ")}
        />
        <KpiItem icon={Server} label="Approved stock" value={formatPower(i.approved_stock_mw)} />
        {i.share_of_ll_u != null && <KpiItem icon={MapPin} label="Zone share of large loads" value={`${(i.share_of_ll_u * 100).toFixed(1)}%`} />}
      </div>
    </SectionCard>
  );
}

/** The last summer in four numbers: our P50, the large loads in it, the band, and ERCOT's adjusted line. */
function PeakStats({ data }: { data: PeakData }) {
  const last = [...data.series].sort((a, b) => b.target_year - a.target_year)[0];
  if (!last) return null;
  const year = last.target_year;
  const largeLoad = data.layers.find((l) => l.target_year === year && l.layer === "large_load");
  const official = data.official.find((o) => o.target_year === year && o.series === "ercot_adjusted");
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <DashboardStatCard layout="stacked" icon={<TrendingUp className="size-4" aria-hidden />} title={`Summer ${year} peak, P50`} value={formatPower(last.p50_mw)} />
      <DashboardStatCard
        layout="stacked"
        icon={<Server className="size-4" aria-hidden />}
        title={`Large loads in ${year}, P50`}
        value={largeLoad ? formatPower(largeLoad.p50_mw) : GAP}
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Ruler className="size-4" aria-hidden />}
        title={last.band_kind ? `${BAND_LABEL[last.band_kind] ?? "Band"}, ${year}` : `Band, ${year}`}
        value={last.p10_mw != null && last.p90_mw != null ? `${formatPower(last.p10_mw)} – ${formatPower(last.p90_mw)}` : GAP}
      />
      <DashboardStatCard
        layout="stacked"
        icon={<Landmark className="size-4" aria-hidden />}
        title={official ? `${official.label}, ${year}` : `ERCOT's line, ${year}`}
        value={official ? formatPower(official.mw) : GAP}
      />
    </div>
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

  const filters = data && (
    <FilterRow>
      <Filter label="Variant">
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
      </Filter>
      <Filter label="Region">
        <SegmentedControl
          label="Region"
          options={regions.map((r) => ({ value: r, label: r }))}
          value={data.region}
          onChange={(next) => void setState({ region: next === "ERCOT" ? null : next })}
        />
      </Filter>
    </FilterRow>
  );

  return (
    <div className="space-y-4">
      {filters}
      <QueryBody<PeakData>
        query={query}
        compact={false}
        isEmpty={(d) => !d.available || d.series.length === 0}
        empty={{ title: "Not available for this region", description: "This variant is built for ERCOT only; pick the default variant for a zone." }}
        skeleton={<Skeleton className="h-96 w-full" />}
      >
        {(d, meta) => (
          <div className="space-y-4">
            <PeakStats data={d} />
            <SectionCard
              title={`Summer peak, ${d.region === "ERCOT" ? "ERCOT" : `${d.region} weather zone`}`}
              icon={TrendingUp}
              subtitle={current ? `${current.label}${current.is_default ? " (default)" : ""} · run of ${formatDate(d.as_of)}` : undefined}
              caveats={meta.caveats}
            >
              <PeakChart data={d} mode={mode} />
            </SectionCard>
            <SectionCard title="The numbers" icon={Table2} subtitle="Every value of the chart, by summer.">
              <div className="space-y-3">
                <PeakNumbers data={d} />
                <BandBasis data={d} />
              </div>
            </SectionCard>
            <InputsCard data={d} />
            <Provenance meta={meta} className="border-t border-border pt-3" />
          </div>
        )}
      </QueryBody>
    </div>
  );
}

/** The table of the chart's numbers, from the same rows. */
function PeakNumbers({ data }: { data: PeakData }) {
  const { rows, officials } = useMemo(() => buildRows(data), [data]);
  const bandKind = data.series.find((s) => s.band_kind)?.band_kind ?? null;
  return <PeakTable rows={rows} officials={officials} bandKind={bandKind} />;
}
