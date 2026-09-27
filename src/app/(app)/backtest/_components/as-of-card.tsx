"use client";

import { CartesianGrid, ComposedChart, usePlotArea, useXAxisScale, useYAxisScale, XAxis, YAxis } from "recharts";

import { MeasuredResponsiveContainer } from "@/components/components-app/charts/utils/MeasuredResponsiveContainer";
import { AppBadge } from "@/components/components-app/ui/badge";
import { VerifiedBadge } from "@/components/product/caveat-badges";
import { formatPercent, formatPower, GAP } from "@/components/product/format";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Caveat, Meta } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import {
  type Cell,
  family,
  groupByTarget,
  gwTick,
  MODEL,
  niceScale,
  orderCells,
  ORGANIC,
  type PeakData,
  PRODUCT_NAME,
  sourceLabel,
  type TargetGroup,
} from "./backtest-data";
import {
  AXIS_LINE,
  AXIS_TICK,
  ChartFrame,
  ChartLegend,
  GRID_CLASS,
  type Hover,
  type LegendItem,
  Mark,
  Point,
  type Readout,
  type Swatch,
  useHover,
  useMode,
  Whisker,
} from "./chart-bits";
import { ACTUAL, type Mode, SERIES } from "./palette";

/** What a cell is called: our model and its ablation by name, an official row by its vintage. */
const cellName = (cell: Cell) => (cell.source === MODEL || cell.source === ORGANIC ? sourceLabel(cell.source) : (cell.vintage ?? sourceLabel(cell.source)));

const range = (low: number | null | undefined, high: number | null | undefined) =>
  low == null || high == null ? GAP : `${formatPower(low)} – ${formatPower(high)}`;

function cellMark(cell: Cell): { shape: "dot" | "square" | "diamond" | "hollow"; swatch: Swatch } {
  if (cell.source === ORGANIC) return { shape: "hollow", swatch: "hollow" };
  if (cell.source === "LTLF-prelim") return { shape: "diamond", swatch: "diamond" };
  if (family(cell.source) === "CDR") return { shape: "square", swatch: "square" };
  return { shape: "dot", swatch: "dot" };
}

/** How far ahead of the backtest date a summer is: `+1`, `+2`. */
const horizonText = (h: number) => `+${h}`;

function cellReadout(cell: Cell, mode: Mode, unverified: Caveat | undefined): Readout {
  const { swatch } = cellMark(cell);
  const color = SERIES[family(cell.source)][mode];
  const rows: Readout["rows"] = [{ swatch, color, label: cell.p10_mw != null ? "P50" : "Forecast", value: formatPower(cell.p50_mw) }];
  if (cell.p10_mw != null || cell.p90_mw != null) rows.push({ label: "P10–P90", value: range(cell.p10_mw, cell.p90_mw) });
  rows.push({ label: cell.actual_final ? "Actual" : "Actual (preliminary)", value: formatPower(cell.actual_mw) });
  rows.push({ label: "Error", value: formatPercent(cell.error_pct, { signed: true }) });
  if (cell.in_band != null) rows.push({ label: "Actual inside P10–P90", value: cell.in_band ? "Yes" : "No" });
  const notes: string[] = [];
  if (PRODUCT_NAME[cell.source]) notes.push(PRODUCT_NAME[cell.source]);
  if (cell.leak_note) notes.push(`Leak note: ${cell.leak_note}`);
  if (cell.verified === false && unverified) notes.push(unverified.label);
  return { title: `${cellName(cell)} · summer ${cell.target_year}`, rows, notes };
}

/** One column per target summer: our band and P50, the ablation, the official vintages, the actual across. */
function AsOfLayer({
  groups,
  mode,
  hover,
  onHover,
  onLeave,
  unverified,
}: {
  groups: TargetGroup[];
  mode: Mode;
  hover: Hover | null;
  onHover: (hover: Hover) => void;
  onLeave: (key: string) => void;
  unverified: Caveat | undefined;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plot = usePlotArea();
  if (!xScale || !yScale || !plot) return null;
  const y = (mw: number) => yScale(mw) as number;
  const column = groups.length > 1 ? Math.abs((xScale(groups[1].targetYear) as number) - (xScale(groups[0].targetYear) as number)) : plot.width;
  const common = { hover, onHover, onLeave, plotMid: plot.x + plot.width * 0.55 };

  return (
    <g>
      {groups.map((group) => {
        const cx = xScale(group.targetYear) as number;
        const items = orderCells(group);
        const step = Math.min(24, column / (items.length + 2));
        const at = (i: number) => cx + (i - (items.length - 1) / 2) * step;
        const half = (items.length / 2) * step + 8;
        return (
          <g key={group.targetYear}>
            {group.actualMw != null && (
              <Mark
                id={`actual-${group.targetYear}`}
                x={cx}
                y={y(group.actualMw)}
                hit={{ x: cx - half, y: y(group.actualMw) - 6, width: half * 2, height: 12 }}
                ring={0}
                label={`Actual summer ${group.targetYear} peak: ${formatPower(group.actualMw)}`}
                readout={{
                  title: `Actual peak, summer ${group.targetYear}`,
                  rows: [
                    {
                      swatch: group.actualFinal ? "line" : "dashed",
                      color: ACTUAL[mode],
                      label: group.actualFinal ? "Actual" : "Actual (preliminary)",
                      value: formatPower(group.actualMw),
                    },
                  ],
                }}
                {...common}
              >
                <line
                  x1={cx - half}
                  x2={cx + half}
                  y1={y(group.actualMw)}
                  y2={y(group.actualMw)}
                  stroke={ACTUAL[mode]}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={group.actualFinal ? undefined : "5 3"}
                />
              </Mark>
            )}
            {items.map((cell, i) => {
              const x = at(i);
              const color = SERIES[family(cell.source)][mode];
              const id = `${group.targetYear}-${cell.source}-${i}`;
              return (
                <Mark
                  key={id}
                  id={id}
                  x={x}
                  y={y(cell.p50_mw)}
                  hit={
                    cell.p10_mw != null && cell.p90_mw != null
                      ? { x: x - 12, y: y(cell.p90_mw) - 6, width: 24, height: y(cell.p10_mw) - y(cell.p90_mw) + 12 }
                      : undefined
                  }
                  label={`${cellName(cell)}, summer ${cell.target_year}: ${formatPower(cell.p50_mw)}`}
                  readout={cellReadout(cell, mode, unverified)}
                  {...common}
                >
                  {cell.source === MODEL && cell.p10_mw != null && cell.p90_mw != null && (
                    <rect
                      x={x - 6}
                      width={12}
                      y={y(cell.p90_mw)}
                      height={Math.max(2, y(cell.p10_mw) - y(cell.p90_mw))}
                      rx={4}
                      fill={color}
                      fillOpacity={0.22}
                    />
                  )}
                  {cell.source === ORGANIC && cell.p10_mw != null && cell.p90_mw != null && (
                    <Whisker x={x} yLow={y(cell.p10_mw)} yHigh={y(cell.p90_mw)} color={color} cap={3} />
                  )}
                  <Point shape={cellMark(cell).shape} x={x} y={y(cell.p50_mw)} color={color} size={cell.source === "LTLF-prelim" ? 5.5 : 4.5} />
                </Mark>
              );
            })}
          </g>
        );
      })}
    </g>
  );
}

/** recharts' tick props, loosely: its coordinates can arrive as strings. */
type TickProps = { x?: number | string; y?: number | string; payload?: { value?: number | string } };

function YearTick({ x, y, payload, horizons }: TickProps & { horizons: Map<number, number> }) {
  const year = Number(payload?.value);
  if (x == null || y == null || !Number.isFinite(year)) return null;
  const h = horizons.get(year);
  return (
    <g transform={`translate(${Number(x)},${Number(y)})`}>
      <text dy={12} textAnchor="middle" className="fill-foreground text-xs font-medium">
        {year}
      </text>
      {h != null && (
        <text dy={26} textAnchor="middle" className="fill-muted-foreground text-[11px]">
          {horizonText(h)}
        </text>
      )}
    </g>
  );
}

function AsOfChart({ groups, unverified }: { groups: TargetGroup[]; unverified: Caveat | undefined }) {
  const mode = useMode();
  const { hover, setHover, clear } = useHover();
  const years = groups.map((g) => g.targetYear);
  const values = groups.flatMap((g) => [g.actualMw, ...orderCells(g).flatMap((c) => [c.p10_mw, c.p50_mw, c.p90_mw])]).filter((v): v is number => v != null);
  const { domain, ticks } = niceScale(values, 5);
  const horizons = new Map(groups.map((g) => [g.targetYear, g.horizon]));

  return (
    <ChartFrame hover={hover} label="The selected date's forecasts of each summer against the actual" className="h-80">
      <MeasuredResponsiveContainer>
        <ComposedChart margin={{ top: 12, right: 16, bottom: 4, left: 4 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} className={GRID_CLASS} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[Math.min(...years) - 0.5, Math.max(...years) + 0.5]}
            ticks={years}
            allowDataOverflow
            height={40}
            tickLine={false}
            axisLine={AXIS_LINE}
            interval={0}
            tick={(props: TickProps) => <YearTick x={props.x} y={props.y} payload={props.payload} horizons={horizons} />}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={domain}
            ticks={ticks}
            tickFormatter={gwTick}
            allowDataOverflow
            width={56}
            tickLine={false}
            axisLine={false}
            tick={AXIS_TICK}
          />
          <AsOfLayer groups={groups} mode={mode} hover={hover} onHover={setHover} onLeave={clear} unverified={unverified} />
        </ComposedChart>
      </MeasuredResponsiveContainer>
    </ChartFrame>
  );
}

/** A row whose model run took an input from after its date: an amber badge, the API's note in its tooltip. */
function LeakBadge({ note }: { note: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="cursor-help">
          <AppBadge state="alert">Leak</AppBadge>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs">
        <p className="font-medium">Input from after this date</p>
        <p>{note}</p>
      </TooltipContent>
    </Tooltip>
  );
}

/** The selected date's cells as rows, a leak note one hover away on its badge. */
function CellsTable({ groups }: { groups: TargetGroup[] }) {
  const th = "py-2 pr-3 font-medium";
  const num = "py-2 pr-3 text-right tabular-nums whitespace-nowrap align-top";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            <th className={cn(th, "text-left")}>Summer</th>
            <th className={cn(th, "text-left")}>Forecast</th>
            <th className={cn(th, "text-right")}>P50</th>
            <th className={cn(th, "text-right")}>P10–P90</th>
            <th className={cn(th, "text-right")}>Actual</th>
            <th className={cn(th, "text-right")}>Error</th>
            <th className={cn(th, "text-left")}>In band</th>
            <th className={cn(th, "w-px text-left")}>Leak</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) =>
            orderCells(group).map((cell, i, rows) => (
              <tr
                key={`${group.targetYear}-${cell.source}-${i}`}
                className={cn("border-border", i === rows.length - 1 && "border-b last:border-0")}
              >
                {i === 0 && (
                  <td rowSpan={rows.length} className="py-2 pr-3 align-top whitespace-nowrap">
                    <span className="font-medium text-foreground tabular-nums">{group.targetYear}</span>
                    <span className="block text-muted-foreground">{horizonText(group.horizon)}</span>
                  </td>
                )}
                <td className="py-2 pr-3 align-top">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    <span className={cn(cell.source === MODEL && "font-medium text-foreground")}>{cellName(cell)}</span>
                    <VerifiedBadge verified={cell.verified} compact />
                  </span>
                </td>
                <td className={num}>{formatPower(cell.p50_mw)}</td>
                <td className={num}>{range(cell.p10_mw, cell.p90_mw)}</td>
                <td className={num}>
                  {formatPower(cell.actual_mw)}
                  {!cell.actual_final && <span className="block text-muted-foreground">preliminary</span>}
                </td>
                <td className={num}>{formatPercent(cell.error_pct, { signed: true })}</td>
                <td className="py-2 pr-3 align-top">
                  {cell.in_band == null ? (
                    <span className="text-muted-foreground">{GAP}</span>
                  ) : (
                    <AppBadge state={cell.in_band ? "active" : "inactive"}>{cell.in_band ? "Inside" : "Outside"}</AppBadge>
                  )}
                </td>
                <td className="py-2 pr-3 align-top">
                  {cell.leak_note ? <LeakBadge note={cell.leak_note} /> : <span className="text-muted-foreground">{GAP}</span>}
                </td>
              </tr>
            )),
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One backtest date: what our model said about each summer ahead with only that date's inputs, against
 * the official vintages published by then and the actual.
 */
export function AsOfBody({ data, meta }: { data: PeakData; meta: Meta }) {
  const mode = useMode();
  const groups = groupByTarget(data.cells);
  const unverified = meta.caveats?.find((c) => c.code === "machine_read_unverified");
  const hasPrelim = data.cells.some((c) => c.source === "LTLF-prelim");
  const hasCdr = data.cells.some((c) => family(c.source) === "CDR");
  const hasOrganic = data.cells.some((c) => c.source === ORGANIC);
  const anyPreliminary = groups.some((g) => !g.actualFinal);

  const legend: LegendItem[] = [
    { key: "model", label: "basecast P50 and P10–P90", swatch: "bar", color: SERIES.basecast[mode] },
    ...(hasOrganic ? [{ key: "organic", label: "basecast, organic only", swatch: "hollow" as const, color: SERIES.organic[mode] }] : []),
    { key: "ltlf", label: "LTLF", swatch: "dot", color: SERIES.LTLF[mode] },
    ...(hasCdr ? [{ key: "cdr", label: "CDR", swatch: "square" as const, color: SERIES.CDR[mode] }] : []),
    ...(hasPrelim ? [{ key: "prelim", label: "Preliminary LTLF", swatch: "diamond" as const, color: SERIES.LTLF[mode] }] : []),
    { key: "actual", label: anyPreliminary ? "Actual (preliminary)" : "Actual", swatch: anyPreliminary ? "dashed" : "line", color: ACTUAL[mode] },
  ];

  return (
    <div className="space-y-4">
      <ChartLegend items={legend} />
      <AsOfChart groups={groups} unverified={unverified} />
      <CellsTable groups={groups} />
    </div>
  );
}
