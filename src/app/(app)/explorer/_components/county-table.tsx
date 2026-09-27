"use client";

import Link from "next/link";
import { useMemo } from "react";

import { type ColumnMetadata, DataTable } from "@/components/components-app/data-table";
import { AppBadge } from "@/components/components-app/ui/badge";
import { formatPercent, formatPower, formatWhole, GAP } from "@/components/product/format";
import {
  CHANNEL_LABEL,
  type ChannelList,
  type CountyRow,
  dataCenterCount,
  type Layer,
  type QueueMetric,
} from "@/lib/explorer/layers";
import { rankedCounties } from "@/lib/explorer/summary";
import { cn } from "@/lib/utils";

import { ScoreBar } from "../../accounts/_components/account-bits";

/** One county flattened for the table: the DataTable keys its columns by the row's own fields. */
type TableRow = {
  county_fips: string;
  county_name: string;
  weather_zone: string | null;
  rank: number | null;
  priority: number | null;
  priority_class: number | null;
  channel: string | null;
  market: number | null;
  grid: number | null;
  projects: number | null;
  raw_mw: number | null;
  adj_mw: number | null;
  ratio: number | null;
  rank_change: number | null;
  sites: number | null;
  naics_only: number | null;
};

function flatten(row: CountyRow, list: ChannelList, naics: boolean): TableRow {
  const a = row.acquisition;
  const q = row.queue;
  return {
    county_fips: row.county_fips,
    county_name: row.county_name,
    weather_zone: row.weather_zone ?? null,
    rank: (list === "retail" ? a?.retail_rank : list === "partnership" ? a?.partner_rank : a?.rank) ?? null,
    priority: a?.priority ?? null,
    priority_class: a?.priority_class ?? null,
    channel: a ? CHANNEL_LABEL[a.channel] : null,
    market: a?.market_score ?? null,
    grid: a?.grid_factor ?? null,
    projects: q?.projects ?? null,
    raw_mw: q?.raw_mw ?? null,
    adj_mw: q?.adj_mw ?? null,
    ratio: q?.ratio ?? null,
    rank_change: q?.rank_change ?? null,
    sites: dataCenterCount(row, naics),
    naics_only: row.data_centers.sites_naics_only,
  };
}

const num = (v: unknown, f: (n: number) => string) => (typeof v === "number" ? <span className="tabular-nums">{f(v)}</span> : GAP);

/** The columns of each layer, the county first; its name opens the county panel. */
function columnsFor(
  layer: Layer,
  list: ChannelList,
  horizon: number | undefined,
  hrefFor: (fips: string) => string,
  selected: string | null,
): ColumnMetadata<TableRow>[] {
  const county: ColumnMetadata<TableRow> = {
    columnId: "county_name",
    title: "County",
    type: "text",
    sortable: true,
    hideable: false,
    cell: ({ row }) => (
      <Link
        href={hrefFor(row.original.county_fips)}
        scroll={false}
        className={cn(
          "font-medium hover:text-basecast-brand hover:underline",
          selected === row.original.county_fips ? "text-basecast-brand" : "text-foreground",
        )}
      >
        {row.original.county_name}
      </Link>
    ),
  };
  const zone: ColumnMetadata<TableRow> = { columnId: "weather_zone", title: "Zone", type: "text", sortable: true };

  if (layer === "acquisition") {
    return [
      {
        columnId: "rank",
        title: list === "retail" ? "Retail rank" : list === "partnership" ? "Partnership rank" : "Rank",
        type: "number",
        sortable: true,
        aligned: "right",
        columnClassName: "w-16",
        formatter: (v) => num(v, String),
      },
      county,
      zone,
      {
        columnId: "priority",
        title: "Priority",
        type: "number",
        sortable: true,
        cell: ({ row }) => (row.original.priority == null ? GAP : <ScoreBar score={row.original.priority} />),
      },
      {
        columnId: "priority_class",
        title: "Class",
        type: "number",
        sortable: true,
        aligned: "center",
        cell: ({ row }) => (row.original.priority_class == null ? GAP : <AppBadge state="meta">{row.original.priority_class}</AppBadge>),
      },
      { columnId: "channel", title: "Channel", type: "text", sortable: true },
      { columnId: "market", title: "Market", type: "number", sortable: true, aligned: "right", formatter: (v) => num(v, (n) => n.toFixed(2)) },
      { columnId: "grid", title: "Grid factor", type: "number", sortable: true, aligned: "right", formatter: (v) => num(v, (n) => n.toFixed(2)) },
    ];
  }
  if (layer === "queue") {
    return [
      county,
      zone,
      { columnId: "projects", title: "Projects", type: "number", sortable: true, aligned: "right", formatter: (v) => num(v, formatWhole) },
      { columnId: "raw_mw", title: "Raw", type: "number", sortable: true, aligned: "right", formatter: (v) => num(v, formatPower) },
      {
        columnId: "adj_mw",
        title: horizon ? `Adj. Dec ${horizon}` : "Adjusted",
        type: "number",
        sortable: true,
        aligned: "right",
        formatter: (v) => num(v, formatPower),
      },
      {
        columnId: "ratio",
        title: "Adjusted ÷ raw",
        type: "number",
        sortable: true,
        aligned: "right",
        formatter: (v) => num(v, (n) => formatPercent(n, { ratio: true })),
      },
      {
        columnId: "rank_change",
        title: "Rank change",
        description: "Raw rank − adjusted rank; + moves up once adjusted",
        type: "number",
        sortable: true,
        aligned: "right",
        formatter: (v) => num(v, (n) => (n > 0 ? `+${n}` : String(n))),
      },
    ];
  }
  return [
    county,
    zone,
    { columnId: "sites", title: "New sites", type: "number", sortable: true, aligned: "right", formatter: (v) => num(v, formatWhole) },
    { columnId: "naics_only", title: "NAICS only", type: "number", sortable: true, aligned: "right", formatter: (v) => num(v, formatWhole) },
  ];
}

/**
 * The map as a table: the counties of the layer in its order (`rankedCounties`), each name a link that opens
 * the county panel. The zone layer has its own table.
 */
export function CountyTable({
  rows,
  layer,
  list,
  metric,
  naics,
  horizon,
  selected,
  hrefFor,
}: {
  rows: CountyRow[];
  layer: Layer;
  list: ChannelList;
  metric: QueueMetric;
  naics: boolean;
  horizon: number | undefined;
  selected: string | null;
  hrefFor: (fips: string) => string;
}) {
  const data = useMemo(
    () => rankedCounties(rows, { layer, list, metric, naics }).map((row) => flatten(row, list, naics)),
    [rows, layer, list, metric, naics],
  );
  const columns = useMemo(() => columnsFor(layer, list, horizon, hrefFor, selected), [layer, list, horizon, hrefFor, selected]);
  return (
    <DataTable<TableRow>
      key={layer}
      columnsMetadata={columns}
      data={data}
      tableName={`explorer-${layer}`}
      language="en"
      bordered
      compact
      enablePagination
      pageSize={25}
      enableDownload={false}
      toolbarIconsOnly
      getRowId={(row) => row.county_fips}
    />
  );
}
