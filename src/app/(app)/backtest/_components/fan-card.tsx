"use client";

import { CartesianGrid, ComposedChart, usePlotArea, useXAxisScale, useYAxisScale, XAxis, YAxis } from "recharts";

import { MeasuredResponsiveContainer } from "@/components/components-app/charts/utils/MeasuredResponsiveContainer";
import { CaveatBadge, VerifiedBadge } from "@/components/product/caveat-badges";
import { formatDate, formatPercent, formatPower, GAP } from "@/components/product/format";
import type { Caveat, Meta } from "@/lib/bff/envelope";

import {
  type ActualPeak,
  dayMs,
  errorPct,
  family,
  type FanParts,
  fanParts,
  type FanPoint,
  gwTick,
  modelAt,
  niceScale,
  officialsInUse,
  type PeakData,
  PRODUCT_NAME,
  yearTicks,
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
  SwatchIcon,
  useHover,
  useMode,
  Whisker,
} from "./chart-bits";
import { ACTUAL, type Mode, SERIES } from "./palette";
import { StatTile } from "./stat-tile";

const DAY = 86_400_000;

const fmtRange = (low: number | null | undefined, high: number | null | undefined) => {
  if (low == null || high == null) return GAP;
  const [a, b] = [formatPower(low), formatPower(high)];
  // "90.5–98.0 GW" when both read in GW, else both units in full.
  return a.endsWith(" GW") && b.endsWith(" GW") ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
};

const vsActual = (value: number | null | undefined, actual: number | null | undefined) =>
  formatPercent(errorPct(value, actual), { signed: true });

/** The shape of an official point: LTLF a dot, CDR a square (a second channel beside the hue). */
const shapeOf = (point: FanPoint) => (family(point.product) === "CDR" ? "square" : "dot");

function officialColor(point: FanPoint, mode: Mode) {
  return SERIES[family(point.product)][mode];
}

function kindLabel(point: FanPoint): string {
  switch (point.kind) {
    case "official":
      return point.product ?? "Official";
    case "official_preliminary":
      return "Preliminary LTLF";
    case "official_range":
      return "ERCOT's range";
    case "actual":
      return "Actual";
    case "model":
      return "basecast";
  }
}

/** The marks of the fan: the actual, ERCOT's range, every official vintage and our model at each date. */
function FanLayer({
  parts,
  targetYear,
  asOf,
  inUse,
  mode,
  hover,
  onHover,
  onLeave,
  preliminaryCaveat,
  unverifiedCaveat,
}: {
  parts: FanParts;
  targetYear: number;
  asOf: string;
  inUse: Set<FanPoint>;
  mode: Mode;
  hover: Hover | null;
  onHover: (hover: Hover) => void;
  onLeave: (key: string) => void;
  preliminaryCaveat: Caveat | undefined;
  unverifiedCaveat: Caveat | undefined;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  const plot = usePlotArea();
  if (!xScale || !yScale || !plot) return null;
  const x = (date: string) => xScale(dayMs(date)) as number;
  const y = (mw: number) => yScale(mw) as number;
  const mid = plot.x + plot.width * 0.55;
  const common = { hover, onHover, onLeave, plotMid: mid };
  const actualMw = parts.actual?.value_mw ?? null;
  const ink = ACTUAL[mode];

  const { actual, range, preliminary } = parts;
  const selectedModel = modelAt(parts.models, asOf);

  return (
    <g>
      {actual?.value_mw != null && (
        <Mark
          id="actual"
          x={plot.x + 8}
          y={y(actual.value_mw)}
          hit={{ x: plot.x, y: y(actual.value_mw) - 6, width: plot.width, height: 12 }}
          ring={0}
          label={`${actual.label}: ${formatPower(actual.value_mw)}`}
          readout={{
            title: actual.label,
            rows: [{ swatch: actual.final ? "line" : "dashed", color: ink, label: `Summer ${targetYear}`, value: formatPower(actual.value_mw) }],
            notes: !actual.final && preliminaryCaveat?.text ? [preliminaryCaveat.text] : undefined,
          }}
          {...common}
        >
          <line
            x1={plot.x}
            x2={plot.x + plot.width}
            y1={y(actual.value_mw)}
            y2={y(actual.value_mw)}
            stroke={ink}
            strokeWidth={1.5}
            strokeDasharray={actual.final ? undefined : "6 4"}
          />
          <text x={plot.x + 6} y={y(actual.value_mw) - 6} className="fill-foreground text-[11px] font-medium">
            {actual.label} · {formatPower(actual.value_mw)}
          </text>
        </Mark>
      )}

      {range?.low_mw != null && range.high_mw != null && range.vintage_date && (
        <Mark
          id="range"
          x={x(range.vintage_date)}
          y={y((range.low_mw + range.high_mw) / 2)}
          hit={{ x: x(range.vintage_date) - 12, y: y(range.high_mw), width: 24, height: y(range.low_mw) - y(range.high_mw) }}
          ring={0}
          label={`${range.label}: ${fmtRange(range.low_mw, range.high_mw)}`}
          readout={{
            title: range.label,
            rows: [
              { swatch: "bar", color: SERIES.LTLF[mode], label: "Low", value: formatPower(range.low_mw) },
              { swatch: "bar", color: SERIES.LTLF[mode], label: "High", value: formatPower(range.high_mw) },
              { label: "Published", value: formatDate(range.vintage_date) },
            ],
            notes: actualMw != null ? [rangeVerdict(range, actualMw)] : undefined,
          }}
          {...common}
        >
          <rect
            x={x(range.vintage_date) - 5}
            width={10}
            y={y(range.high_mw)}
            height={Math.max(2, y(range.low_mw) - y(range.high_mw))}
            rx={4}
            fill={SERIES.LTLF[mode]}
            fillOpacity={0.4}
          />
        </Mark>
      )}

      {parts.officials.map((point, i) =>
        point.value_mw == null || !point.vintage_date ? null : (
          <Mark
            key={`${point.label}-${i}`}
            id={`official-${i}`}
            x={x(point.vintage_date)}
            y={y(point.value_mw)}
            label={`${point.label}: ${formatPower(point.value_mw)}`}
            readout={officialReadout(point, targetYear, actualMw, mode, inUse.has(point) ? asOf : null)}
            {...common}
          >
            <Point shape={shapeOf(point)} x={x(point.vintage_date)} y={y(point.value_mw)} color={officialColor(point, mode)} />
          </Mark>
        ),
      )}

      {preliminary?.value_mw != null && preliminary.vintage_date && (
        <Mark
          id="preliminary"
          x={x(preliminary.vintage_date)}
          y={y(preliminary.value_mw)}
          ring={11}
          label={`${preliminary.label}: ${formatPower(preliminary.value_mw)}`}
          readout={officialReadout(preliminary, targetYear, actualMw, mode, inUse.has(preliminary) ? asOf : null)}
          {...common}
        >
          <Point shape="diamond" size={5.5} x={x(preliminary.vintage_date)} y={y(preliminary.value_mw)} color={SERIES.LTLF[mode]} />
          <text
            x={x(preliminary.vintage_date) - 14}
            y={y(preliminary.value_mw) + 4}
            textAnchor="end"
            className="fill-foreground text-[11px] font-medium"
          >
            Preliminary long-term forecast · {formatPower(preliminary.value_mw)}
          </text>
        </Mark>
      )}

      {parts.models.map((point, i) => {
        if (point.value_mw == null || !point.vintage_date) return null;
        const cx = x(point.vintage_date);
        return (
          <Mark
            key={point.label}
            id={`model-${i}`}
            x={cx}
            y={y(point.value_mw)}
            label={`${point.label}: ${formatPower(point.value_mw)}`}
            readout={modelReadout(point, targetYear, actualMw, mode, unverifiedCaveat)}
            {...common}
          >
            {point.low_mw != null && point.high_mw != null && (
              <Whisker x={cx} yLow={y(point.low_mw)} yHigh={y(point.high_mw)} color={SERIES.basecast[mode]} />
            )}
            <Point shape="dot" x={cx} y={y(point.value_mw)} color={SERIES.basecast[mode]} />
          </Mark>
        );
      })}

      {/* Drawn last, over every mark: what the selected backtest date used. */}
      <g pointerEvents="none">
        {[...parts.officials, preliminary].map((point, i) =>
          point && inUse.has(point) && point.value_mw != null && point.vintage_date ? (
            <SelectedRing
              key={`used-${i}`}
              x={x(point.vintage_date)}
              y={y(point.value_mw)}
              r={point === preliminary ? 11 : 8.5}
            />
          ) : null,
        )}
        {selectedModel?.value_mw != null && selectedModel.vintage_date && (
          <SelectedRing x={x(selectedModel.vintage_date)} y={y(selectedModel.value_mw)} />
        )}
      </g>
    </g>
  );
}

/** The ring that marks what the selected backtest date used. */
function SelectedRing({ x, y, r = 8.5 }: { x: number; y: number; r?: number }) {
  return <circle cx={x} cy={y} r={r} fill="none" strokeWidth={1.5} className="stroke-foreground" />;
}

function rangeVerdict(range: FanPoint, actual: number): string {
  if (range.low_mw == null || range.high_mw == null) return "";
  if (actual < range.low_mw) return "The actual landed below this range.";
  if (actual > range.high_mw) return "The actual landed above this range.";
  return "The actual landed inside this range.";
}

function officialReadout(point: FanPoint, targetYear: number, actual: number | null, mode: Mode, usedAt: string | null): Readout {
  const notes = [PRODUCT_NAME[point.product ?? ""]].filter(Boolean) as string[];
  if (usedAt) notes.push(`The official vintage the backtest as of ${formatDate(usedAt)} scores against.`);
  return {
    title: point.label,
    rows: [
      {
        swatch: point.kind === "official_preliminary" ? "diamond" : shapeOf(point),
        color: officialColor(point, mode),
        label: `Summer ${targetYear}`,
        value: formatPower(point.value_mw),
      },
      { label: "Published", value: formatDate(point.vintage_date) },
      { label: "vs the actual", value: vsActual(point.value_mw, actual) },
    ],
    notes,
  };
}

function modelReadout(point: FanPoint, targetYear: number, actual: number | null, mode: Mode, unverified: Caveat | undefined): Readout {
  const notes = point.verified === false && unverified ? [`${unverified.label}: ${unverified.text}`] : [];
  return {
    title: point.label,
    rows: [
      { swatch: "dot", color: SERIES.basecast[mode], label: `P50, summer ${targetYear}`, value: formatPower(point.value_mw) },
      { swatch: "whisker", color: SERIES.basecast[mode], label: "P10–P90", value: fmtRange(point.low_mw, point.high_mw) },
      { label: "vs the actual", value: vsActual(point.value_mw, actual) },
    ],
    notes,
  };
}

function FanChart({
  parts,
  targetYear,
  asOf,
  inUse,
  preliminaryCaveat,
  unverifiedCaveat,
}: {
  parts: FanParts;
  targetYear: number;
  asOf: string;
  inUse: Set<FanPoint>;
  preliminaryCaveat: Caveat | undefined;
  unverifiedCaveat: Caveat | undefined;
}) {
  const mode = useMode();
  const { hover, setHover, clear } = useHover();
  const dated = [...parts.officials, ...parts.models, parts.preliminary, parts.range].filter(
    (p): p is FanPoint => !!p?.vintage_date,
  );
  const times = dated.map((p) => dayMs(p.vintage_date!));
  const x0 = Math.min(...times) - 120 * DAY;
  const x1 = Math.max(...times) + 120 * DAY;
  const values = [
    ...dated.flatMap((p) => [p.value_mw, p.low_mw, p.high_mw]),
    parts.actual?.value_mw,
  ].filter((v): v is number => v != null);
  const { domain, ticks } = niceScale(values, 5);
  const years = (x1 - x0) / (365 * DAY);
  const xTicks = yearTicks(x0, x1, years > 8 ? 2 : 1);

  return (
    <ChartFrame hover={hover} label={`Every forecast of the summer ${targetYear} peak, by publication date, against the actual`} className="h-80">
      <MeasuredResponsiveContainer>
        <ComposedChart margin={{ top: 14, right: 16, bottom: 4, left: 4 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} className={GRID_CLASS} />
          <XAxis
            type="number"
            dataKey="x"
            domain={[x0, x1]}
            ticks={xTicks}
            tickFormatter={(v: number) => String(new Date(v).getUTCFullYear())}
            allowDataOverflow
            tickLine={false}
            axisLine={AXIS_LINE}
            tick={AXIS_TICK}
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
          <FanLayer
            parts={parts}
            targetYear={targetYear}
            asOf={asOf}
            inUse={inUse}
            mode={mode}
            hover={hover}
            onHover={setHover}
            onLeave={clear}
            preliminaryCaveat={preliminaryCaveat}
            unverifiedCaveat={unverifiedCaveat}
          />
        </ComposedChart>
      </MeasuredResponsiveContainer>
    </ChartFrame>
  );
}

/** The fan as rows: every mark with its date, value and distance to the actual. */
function FanTable({ fan, targetYear, actual }: { fan: FanPoint[]; targetYear: number; actual: number | null }) {
  const rows = [...fan].sort((a, b) => (a.vintage_date ?? "9999").localeCompare(b.vintage_date ?? "9999"));
  const th = "py-2 pr-3 font-medium";
  const num = "py-2 pr-3 text-right tabular-nums whitespace-nowrap";
  return (
    <div className="max-h-96 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card text-muted-foreground">
          <tr className="border-b border-border">
            <th className={`${th} text-left`}>Forecast</th>
            <th className={`${th} text-left`}>Kind</th>
            <th className={`${th} text-left`}>Published</th>
            <th className={`${th} text-right`}>Summer {targetYear}</th>
            <th className={`${th} text-right`}>Range</th>
            <th className={`${th} text-right`}>vs the actual</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((point, i) => (
            <tr key={`${point.kind}-${point.label}-${i}`} className="border-b border-border last:border-0">
              <td className="py-2 pr-3">
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {point.label}
                  <VerifiedBadge verified={point.verified} />
                </span>
              </td>
              <td className="py-2 pr-3 text-muted-foreground">{kindLabel(point)}</td>
              <td className="py-2 pr-3 whitespace-nowrap">{formatDate(point.vintage_date)}</td>
              <td className={num}>{formatPower(point.value_mw)}</td>
              <td className={num}>{point.low_mw != null ? fmtRange(point.low_mw, point.high_mw) : GAP}</td>
              <td className={num}>{point.kind === "actual" || point.value_mw == null ? GAP : vsActual(point.value_mw, actual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The latest summer's fan: four headline numbers (the actual, the preliminary long-term forecast, ERCOT's
 * own range and our model at the selected date), then every forecast of that summer by publication date.
 */
export function FanBody({
  data,
  meta,
  asOf,
  view,
}: {
  data: PeakData;
  meta: Meta;
  asOf: string;
  view: "chart" | "table";
}) {
  const mode = useMode();
  const parts = fanParts(data.fan);
  const targetYear = data.fan_target_year;
  const actualMw = parts.actual?.value_mw ?? null;
  const preliminaryCaveat = meta.caveats?.find((c) => c.code === "preliminary_actuals");
  const unverifiedCaveat = meta.caveats?.find((c) => c.code === "machine_read_unverified");
  const inUse = officialsInUse(data.fan, data.cells, targetYear);

  const legend: LegendItem[] = [
    { key: "model", label: "basecast P50, P10–P90 at each backtest date", swatch: "whisker", color: SERIES.basecast[mode] },
    { key: "ltlf", label: "LTLF vintages", swatch: "dot", color: SERIES.LTLF[mode] },
    { key: "cdr", label: "CDR vintages", swatch: "square", color: SERIES.CDR[mode] },
    { key: "prelim", label: "Preliminary long-term forecast", swatch: "diamond", color: SERIES.LTLF[mode] },
    { key: "range", label: "ERCOT's projected range", swatch: "bar", color: SERIES.LTLF[mode] },
    { key: "actual", label: parts.actual?.final === false ? "Actual (preliminary)" : "Actual", swatch: parts.actual?.final === false ? "dashed" : "line", color: ACTUAL[mode] },
  ];

  return (
    <div className="space-y-4">
      {view === "chart" ? (
        <>
          <ChartLegend items={legend} />
          <FanChart
            parts={parts}
            targetYear={targetYear}
            asOf={asOf}
            inUse={inUse}
            preliminaryCaveat={preliminaryCaveat}
            unverifiedCaveat={unverifiedCaveat}
          />
          <p className="text-xs text-muted-foreground">
            Each mark is a forecast of the summer {targetYear} peak at the date it was published. The ringed marks are
            what the backtest date selected above used: our model then, and the official vintages it is scored
            against.
          </p>
        </>
      ) : (
        <FanTable fan={data.fan} targetYear={targetYear} actual={actualMw} />
      )}
    </div>
  );
}

/**
 * The latest summer in four stat cards: the actual peak, the preliminary long-term forecast, ERCOT's own
 * range, and our model at the backtest date, each marked with its swatch in the chart.
 */
export function FanStats({
  data,
  meta,
  asOf,
}: {
  data: PeakData;
  meta: Meta;
  asOf: string;
}) {
  const mode = useMode();
  const parts = fanParts(data.fan);
  const targetYear = data.fan_target_year;
  const actualMw = parts.actual?.value_mw ?? null;
  const actualPeak: ActualPeak | undefined = data.actuals.find((a) => a.year === targetYear);
  const preliminaryCaveat = meta.caveats?.find((c) => c.code === "preliminary_actuals");
  const model = modelAt(parts.models, asOf);
  const { preliminary, range } = parts;
  const miss = preliminary?.value_mw != null && actualMw != null ? preliminary.value_mw - actualMw : null;

  return (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
      <StatTile
        label={`Actual peak, summer ${targetYear}`}
        swatch={<SwatchIcon swatch={parts.actual?.final === false ? "dashed" : "line"} color={ACTUAL[mode]} />}
        fact={{
          value: actualMw,
          unit: "MW",
          label: parts.actual?.label,
          source: parts.actual?.source,
          as_of: meta.data_as_of,
          verified: parts.actual?.verified,
          // A Fact without `simulated` would read as simulated: the response says.
          simulated: meta.simulated,
        }}
        badges={parts.actual?.final === false && preliminaryCaveat ? <CaveatBadge caveat={preliminaryCaveat} /> : null}
        caption={
          actualPeak?.peak_ts_utc
            ? `${formatDate(actualPeak.peak_ts_utc)}${actualPeak.hour_ending_local != null ? `, hour ending ${actualPeak.hour_ending_local}` : ""}`
            : undefined
        }
      />
      <StatTile
        label="Preliminary long-term forecast"
        swatch={<SwatchIcon swatch="diamond" color={SERIES.LTLF[mode]} />}
        fact={{
          value: preliminary?.value_mw ?? null,
          unit: "MW",
          label: preliminary?.label,
          source: preliminary?.source,
          as_of: preliminary?.vintage_date,
          verified: preliminary?.verified,
          simulated: meta.simulated,
        }}
        caption={
          preliminary && (
            <>
              {preliminary.vintage}, {formatDate(preliminary.vintage_date)}.
              {miss != null && (
                <>
                  {" "}
                  About {Math.abs(Math.round(miss / 1_000))} GW {miss >= 0 ? "above" : "below"} the actual (
                  {vsActual(preliminary.value_mw, actualMw)}).
                </>
              )}
            </>
          )
        }
      />
      <StatTile
        label="ERCOT's projected range"
        swatch={<SwatchIcon swatch="bar" color={SERIES.LTLF[mode]} />}
        fact={{
          value: range?.low_mw ?? null,
          label: range?.label,
          source: range?.source,
          as_of: range?.vintage_date,
          verified: range?.verified,
          simulated: meta.simulated,
        }}
        format={() => fmtRange(range?.low_mw, range?.high_mw)}
        caption={
          range && (
            <>
              {range.vintage}, {formatDate(range.vintage_date)}.{actualMw != null && <> {rangeVerdict(range, actualMw)}</>}
            </>
          )
        }
      />
      <StatTile
        label={`basecast as of ${formatDate(asOf)}`}
        swatch={<SwatchIcon swatch="whisker" color={SERIES.basecast[mode]} />}
        fact={{
          value: model?.value_mw ?? null,
          unit: "MW",
          label: model?.label,
          source: model?.source,
          as_of: model?.vintage_date,
          verified: model?.verified,
          simulated: meta.simulated,
        }}
        caption={
          model && (
            <>
              P10–P90 {fmtRange(model.low_mw, model.high_mw)} · {vsActual(model.value_mw, actualMw)} vs the actual.
            </>
          )
        }
      />
    </div>
  );
}
