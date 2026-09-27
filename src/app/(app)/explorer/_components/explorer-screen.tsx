"use client";

import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useCallback, useMemo, useState } from "react";

import { DataCard } from "@/components/product/data-card";
import { formatDate, formatPercent, formatPower } from "@/components/product/format";
import { SegmentedControl } from "@/components/product/segmented-control";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { components } from "@/lib/api/get-data";
import type { CaveatCode } from "@/lib/bff/envelope";
import { useProductQuery } from "@/lib/bff/queries";
import type { Mode } from "@/lib/explorer/colors";
import {
  CHANNEL_LABEL,
  type CountiesData,
  type CountyRow,
  dataCenterCount,
  LAYER_LABEL,
  LAYERS,
  LIST_LABEL,
  LISTS,
  paintLayer,
  QUEUE_METRIC_LABEL,
  QUEUE_METRICS,
  queueValue,
} from "@/lib/explorer/layers";
import { useTheme } from "@/lib/hooks/use-theme";

import { type CountyHover, CountyMap } from "./county-map";
import { CountyPanel, STRATUM_LABEL } from "./county-panel";
import { AcquisitionLegend, SwatchLegend } from "./map-legend";

type QueueBacktest = components["schemas"]["QueueBacktestData"];

const FIPS = /^\d{5}$/;

const explorerParsers = {
  layer: parseAsStringLiteral(LAYERS).withDefault("acquisition"),
  list: parseAsStringLiteral(LISTS).withDefault("all"),
  metric: parseAsStringLiteral(QUEUE_METRICS).withDefault("adjusted"),
  horizon: parseAsInteger,
  stratum: parseAsString.withDefault("all"),
  naics: parseAsBoolean.withDefault(true),
  county: parseAsString,
};

/** The caveats each layer carries (the ones about fixtures and simulation show on every layer). */
const LAYER_CAVEATS: Record<(typeof LAYERS)[number], CaveatCode[]> = {
  acquisition: ["by_area_not_homes"],
  queue: ["beyond_backtested_window", "machine_read_unverified"],
  "data-centers": ["by_county_not_point"],
};
const ALWAYS: CaveatCode[] = ["fixture", "simulated"];

const range = (values: number[]) => {
  const present = values.filter((v) => Number.isFinite(v));
  if (!present.length) return null;
  const [low, high] = [Math.min(...present), Math.max(...present)];
  return low === high ? low.toFixed(2) : `${low.toFixed(2)}–${high.toFixed(2)}`;
};

/** How far to trust the adjusted queue: the backtest's error by snapshot and the county-rank correlation, from the API. */
function QueueCredibility() {
  const backtest = useProductQuery<QueueBacktest>("backtest/queue", undefined, { throwOnError: false });
  const data = backtest.data?.data;
  if (!data) return null;
  const statewide = data.items.filter((row) => row.stratum === "all");
  const adj = range(data.county_rank.map((r) => r.rho_adj ?? Number.NaN));
  const raw = range(data.county_rank.map((r) => r.rho_raw ?? Number.NaN));
  if (!statewide.length && !adj) return null;
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-foreground">How far to trust it.</span>{" "}
      {statewide.length > 0 && (
        <>
          Backtest of the generation queue over {statewide[0].window_months} months: predicted vs built{" "}
          {statewide.map((r) => `${formatPercent(r.error_pct, { signed: true })} (${formatDate(r.report_month)})`).join(", ")}.{" "}
        </>
      )}
      {adj && raw && <>County rank correlation (Spearman) {adj} adjusted vs {raw} raw.</>}
    </p>
  );
}

/** What the pointer is over: the county and the layer's reading of it. */
function HoverCard({ row, layer, metric, naics }: { row: CountyRow; layer: string; metric: (typeof QUEUE_METRICS)[number]; naics: boolean }) {
  const a = row.acquisition;
  let lines: string[] = [];
  if (!row.in_ercot) lines = ["Outside ERCOT"];
  else if (layer === "acquisition") {
    lines = a
      ? [
          `Priority ${a.priority.toFixed(2)} · class ${a.priority_class} of 5 · rank ${a.rank}`,
          `market ${a.market_score.toFixed(2)} × grid ${a.grid_factor.toFixed(2)}`,
          `${CHANNEL_LABEL[a.channel]} · ${formatPercent(a.partner_share, { ratio: true })} co-op/muni land`,
        ]
      : ["No acquisition score"];
  } else if (layer === "queue") {
    const q = row.queue;
    const value = queueValue(row, metric);
    lines = q
      ? [
          `${QUEUE_METRIC_LABEL[metric]}: ${metric === "ratio" ? (value?.toFixed(2) ?? "—") : metric === "rank_change" ? `${value && value > 0 ? "+" : ""}${value}` : formatPower(value)}`,
          `Raw ${formatPower(q.raw_mw)} → adjusted ${formatPower(q.adj_mw)} · ${q.projects} projects`,
          ...(q.large_gas_mw_2028 ? [`Large new gas: ${formatPower(q.large_gas_mw_2028)}`] : []),
        ]
      : ["No active project in the generation queue"];
  } else {
    const n = dataCenterCount(row, naics);
    lines = [`${n} new data-center ${n === 1 ? "site" : "sites"} since 2025`];
    if (row.data_centers.sites_naics_only) lines.push(`${row.data_centers.sites_naics_only} matched on NAICS only`);
  }
  return (
    <div className="space-y-0.5 text-xs">
      <p className="font-medium text-foreground">
        {row.county_name} <span className="font-normal text-muted-foreground">{row.weather_zone ?? ""}</span>
      </p>
      {lines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  );
}

/** /explorer: the Texas counties by acquisition priority, generation queue or new data centers. */
export function ExplorerScreen() {
  const [state, setState] = useQueryStates(explorerParsers);
  const { resolvedTheme } = useTheme();
  const mode: Mode = resolvedTheme === "dark" ? "dark" : "light";
  const [hover, setHover] = useState<CountyHover | null>(null);
  const county = state.county && FIPS.test(state.county) ? state.county : null;

  const counties = useProductQuery<CountiesData>(
    "geo/counties",
    { horizon: state.horizon ?? undefined, stratum: state.stratum === "all" ? undefined : state.stratum },
    { keepPrevious: true },
  );
  const data = counties.data?.data;
  const rows = useMemo(() => data?.items ?? [], [data]);
  const byFips = useMemo(() => new Map(rows.map((r) => [r.county_fips, r])), [rows]);
  const options = { layer: state.layer, list: state.list, metric: state.metric, naics: state.naics };
  const paint = useMemo(
    () => paintLayer(rows, { layer: state.layer, list: state.list, metric: state.metric, naics: state.naics }, mode),
    [rows, state.layer, state.list, state.metric, state.naics, mode],
  );
  const onSelect = useCallback((fips: string) => void setState({ county: fips }), [setState]);

  const hovered = hover ? byFips.get(hover.fips) : undefined;
  const shownCaveats = [...LAYER_CAVEATS[state.layer], ...ALWAYS];

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {state.layer === "acquisition" && (
        <SegmentedControl
          label="Channel list"
          options={LISTS.map((value) => ({ value, label: LIST_LABEL[value] }))}
          value={state.list}
          onChange={(list) => void setState({ list: list === "all" ? null : list })}
        />
      )}
      {state.layer === "queue" && data && (
        <>
          <SegmentedControl
            label="Metric"
            options={QUEUE_METRICS.map((value) => ({ value, label: QUEUE_METRIC_LABEL[value] }))}
            value={state.metric}
            onChange={(metric) => void setState({ metric: metric === "adjusted" ? null : metric })}
          />
          <SegmentedControl
            label="Horizon"
            options={data.horizons.map((value) => ({ value, label: `Dec ${value}` }))}
            value={data.horizon}
            onChange={(horizon) => void setState({ horizon })}
          />
          <SegmentedControl
            label="Stratum"
            options={data.strata.map((value) => ({ value, label: STRATUM_LABEL[value] ?? value }))}
            value={data.stratum}
            onChange={(stratum) => void setState({ stratum: stratum === "all" ? null : stratum })}
          />
        </>
      )}
      {state.layer === "data-centers" && (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          <Switch checked={state.naics} onCheckedChange={(on) => void setState({ naics: on ? null : false })} />
          Include NAICS-only matches
        </label>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          label="Layer"
          options={LAYERS.map((value) => ({ value, label: LAYER_LABEL[value] }))}
          value={state.layer}
          onChange={(layer) => void setState({ layer: layer === "acquisition" ? null : layer })}
        />
        {controls}
      </div>
      <div className={county ? "grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]" : undefined}>
        <DataCard<CountiesData>
          title={
            state.layer === "queue" && data
              ? `Generation queue · ${QUEUE_METRIC_LABEL[state.metric]}${state.metric === "raw" ? "" : ` by Dec ${data.horizon}`}${data.stratum === "all" ? "" : ` · ${STRATUM_LABEL[data.stratum] ?? data.stratum}`}`
              : LAYER_LABEL[state.layer]
          }
          subtitle={
            state.layer === "acquisition"
              ? "Where to win customers: priority by county, colored by the channel that reaches them."
              : state.layer === "queue"
                ? `Raw requests against the MW the model expects to reach commercial operation${data?.queue_as_of_month ? ` · ${formatDate(data.queue_as_of_month)} report` : ""}.`
                : "Data-center sites with a TCEQ permit since 2025, counted by county."
          }
          query={counties}
          omitCaveats={
            (counties.data?.meta.caveats ?? []).map((c) => c.code).filter((code) => !shownCaveats.includes(code))
          }
          skeleton={<Skeleton className="h-[62vh] w-full" />}
        >
          {() => (
            <div className="space-y-4">
              <div className="relative">
                <CountyMap
                  styles={paint.styles}
                  mode={mode}
                  selected={county}
                  onHover={setHover}
                  onSelect={onSelect}
                  className="h-[62vh] min-h-[420px] overflow-hidden rounded-md border border-border bg-card"
                />
                {hovered && hover && (
                  <div
                    className="pointer-events-none absolute z-10 max-w-72 rounded-md border border-border bg-popover px-3 py-2 shadow-md"
                    style={{ left: hover.x + 14, top: hover.y + 14 }}
                  >
                    <HoverCard row={hovered} layer={state.layer} metric={options.metric} naics={options.naics} />
                  </div>
                )}
              </div>
              {state.layer === "acquisition" && data ? (
                <AcquisitionLegend breaks={data.legend.breaks} mode={mode} />
              ) : (
                <SwatchLegend items={paint.legend} mode={mode} />
              )}
              {state.layer === "queue" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Rank change is the county&apos;s rank by raw MW minus its rank by adjusted MW: positive moves up once
                    adjusted.
                  </p>
                  <QueueCredibility />
                </div>
              )}
            </div>
          )}
        </DataCard>
        {county && <CountyPanel fips={county} mode={mode} onClose={() => void setState({ county: null })} />}
      </div>
    </div>
  );
}
