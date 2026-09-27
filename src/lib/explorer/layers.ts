import type { components } from "@/lib/api/get-data";

import { type Channel, channelColor, DIVERGING, type Mode, NO_DATA, OUTSIDE, SEQUENTIAL } from "./colors";

export type CountyRow = components["schemas"]["CountyRow"];
export type CountiesData = components["schemas"]["CountiesData"];

export const LAYERS = ["acquisition", "queue", "data-centers"] as const;
export type Layer = (typeof LAYERS)[number];
export const LAYER_LABEL: Record<Layer, string> = {
  acquisition: "Acquisition priority",
  queue: "Generation queue",
  "data-centers": "New data centers",
};

export const LISTS = ["all", "retail", "partnership"] as const;
export type ChannelList = (typeof LISTS)[number];
export const LIST_LABEL: Record<ChannelList, string> = {
  all: "All",
  retail: "Retail-direct list",
  partnership: "Partnership list",
};

export const QUEUE_METRICS = ["raw", "adjusted", "ratio", "rank_change"] as const;
export type QueueMetric = (typeof QUEUE_METRICS)[number];
export const QUEUE_METRIC_LABEL: Record<QueueMetric, string> = {
  raw: "Raw MW",
  adjusted: "Adjusted MW",
  ratio: "Ratio",
  rank_change: "Rank change",
};

export const CHANNEL_LABEL: Record<Channel, string> = {
  retail_direct: "Retail-direct",
  partnership: "Partnership",
  mixed: "Mixed",
};

export type LayerOptions = {
  layer: Layer;
  list: ChannelList;
  metric: QueueMetric;
  /** Count the data-center matches on NAICS 518210 only. */
  naics: boolean;
};

/** How one county is drawn: its fill, and whether it is faded (outside the chosen channel list). */
export type CountyStyle = { color: string; dim: boolean };

/** A legend entry: a swatch and what it stands for. */
export type LegendItem = { color: string; label: string };

/** The value the queue metric reads, `null` when the county has no active project in the stratum. */
export function queueValue(row: CountyRow, metric: QueueMetric): number | null {
  const q = row.queue;
  if (!q) return null;
  switch (metric) {
    case "raw":
      return q.raw_mw;
    case "adjusted":
      return q.adj_mw;
    case "ratio":
      return q.ratio ?? null;
    case "rank_change":
      return q.rank_change;
  }
}

export function dataCenterCount(row: CountyRow, naics: boolean): number {
  return naics ? row.data_centers.sites : row.data_centers.sites - row.data_centers.sites_naics_only;
}

/**
 * Class breaks for a magnitude: quantiles of the values present, rounded to their scale, so each of the
 * ramp's steps holds about as many counties. Display bins only; nothing here ranks a county.
 */
export function quantileBreaks(values: number[], classes: number): number[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const breaks: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    const v = sorted[Math.min(sorted.length - 1, Math.floor((i * sorted.length) / classes))];
    if (breaks.length === 0 || v > breaks[breaks.length - 1]) breaks.push(v);
  }
  return breaks;
}

/** The class of a value given ascending breaks: 0 below the first break, `breaks.length` at or above the last. */
export function classOf(value: number, breaks: number[]): number {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i += 1;
  return i;
}

/** Spreads `n` classes over a ramp of more steps, keeping both ends. */
function rampSteps(ramp: string[], n: number): string[] {
  if (n <= 1) return [ramp[ramp.length - 1]];
  return Array.from({ length: n }, (_, i) => ramp[Math.round((i * (ramp.length - 1)) / (n - 1))]);
}

const inList = (row: CountyRow, list: ChannelList) =>
  list === "all" ||
  (list === "retail" && row.acquisition?.retail_rank != null) ||
  (list === "partnership" && row.acquisition?.partner_rank != null);

export type LayerPaint = {
  styles: Map<string, CountyStyle>;
  legend: LegendItem[];
};

/** Every county's fill for the layer, and the legend that explains it. */
export function paintLayer(rows: CountyRow[], options: LayerOptions, mode: Mode): LayerPaint {
  const styles = new Map<string, CountyStyle>();
  const outside = (row: CountyRow) => styles.set(row.county_fips, { color: OUTSIDE[mode], dim: false });

  if (options.layer === "acquisition") {
    for (const row of rows) {
      const a = row.acquisition;
      if (!row.in_ercot || !a) {
        outside(row);
        continue;
      }
      styles.set(row.county_fips, {
        color: channelColor(a.channel, a.priority_class, mode),
        dim: !inList(row, options.list),
      });
    }
    return { styles, legend: [] };
  }

  if (options.layer === "queue") {
    const values = rows.filter((r) => r.in_ercot).map((r) => queueValue(r, options.metric));
    const present = values.filter((v): v is number => v !== null);
    if (options.metric === "rank_change") {
      const magnitudes = present.filter((v) => v !== 0).map(Math.abs);
      const [small, large] = quantileBreaks(magnitudes, 3);
      const edges = [-(large ?? 1), -(small ?? 1), 0, 1, small ?? 1, large ?? 1];
      const colorOf = (v: number) => {
        if (v === 0) return DIVERGING[mode][3];
        const sign = v > 0 ? 1 : -1;
        const step = Math.abs(v) >= (large ?? Infinity) ? 3 : Math.abs(v) >= (small ?? Infinity) ? 2 : 1;
        return DIVERGING[mode][3 + sign * step];
      };
      for (const row of rows) {
        if (!row.in_ercot) outside(row);
        else {
          const v = queueValue(row, "rank_change");
          styles.set(row.county_fips, { color: v === null ? NO_DATA[mode] : colorOf(v), dim: false });
        }
      }
      const fmt = (n: number) => `${n > 0 ? "+" : ""}${n}`;
      const legend: LegendItem[] = [
        { color: DIVERGING[mode][0], label: `≤ ${fmt(edges[0])}` },
        { color: DIVERGING[mode][2], label: `${fmt(edges[1] + 1)} to -1` },
        { color: DIVERGING[mode][3], label: "No change" },
        { color: DIVERGING[mode][4], label: `+1 to ${fmt(edges[4] - 1)}` },
        { color: DIVERGING[mode][6], label: `≥ ${fmt(edges[5])}` },
        { color: NO_DATA[mode], label: "No active project" },
      ];
      return { styles, legend };
    }
    const breaks = quantileBreaks(present, 5);
    const ramp = rampSteps(SEQUENTIAL[mode], breaks.length + 1);
    for (const row of rows) {
      if (!row.in_ercot) outside(row);
      else {
        const v = queueValue(row, options.metric);
        styles.set(row.county_fips, { color: v === null ? NO_DATA[mode] : ramp[classOf(v, breaks)], dim: false });
      }
    }
    return { styles, legend: [...rangeLegend(ramp, breaks, options.metric), { color: NO_DATA[mode], label: "No active project" }] };
  }

  const counts = rows.filter((r) => r.in_ercot).map((r) => dataCenterCount(r, options.naics));
  const positive = counts.filter((c) => c > 0);
  const breaks = quantileBreaks(positive, 4).filter((b) => b > 1);
  const ramp = rampSteps(SEQUENTIAL[mode].slice(2), breaks.length + 1);
  for (const row of rows) {
    if (!row.in_ercot) outside(row);
    else {
      const c = dataCenterCount(row, options.naics);
      styles.set(row.county_fips, { color: c === 0 ? NO_DATA[mode] : ramp[classOf(c, breaks)], dim: false });
    }
  }
  const edges = [1, ...breaks];
  const legend = ramp.map((color, i) => ({
    color,
    label:
      i === ramp.length - 1
        ? `${edges[i]}+ sites`
        : edges[i + 1] - 1 === edges[i]
          ? `${edges[i]} ${edges[i] === 1 ? "site" : "sites"}`
          : `${edges[i]}–${edges[i + 1] - 1} sites`,
  }));
  return { styles, legend: [...legend, { color: NO_DATA[mode], label: "None since 2025" }] };
}

function metricText(value: number, metric: QueueMetric): string {
  if (metric === "ratio") return value.toFixed(2);
  return value >= 10_000 ? `${(value / 1_000).toFixed(1)} GW` : `${Math.round(value).toLocaleString("en-US")} MW`;
}

function rangeLegend(ramp: string[], breaks: number[], metric: QueueMetric): LegendItem[] {
  return ramp.map((color, i) => ({
    color,
    label:
      i === 0
        ? `< ${metricText(breaks[0] ?? 0, metric)}`
        : i === ramp.length - 1
          ? `≥ ${metricText(breaks[i - 1], metric)}`
          : `${metricText(breaks[i - 1], metric)} – ${metricText(breaks[i], metric)}`,
  }));
}
