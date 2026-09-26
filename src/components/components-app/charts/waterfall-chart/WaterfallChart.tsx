"use client"

import React from "react"
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Customized,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { cn } from "@/lib/utils"

import {
  type ChartColor,
  chartColorToCss,
} from "../utils/chartColors"
import { computeNiceTicks, inferYAxisWidth } from "../utils/chartHelpers"
import { MeasuredResponsiveContainer } from "../utils/MeasuredResponsiveContainer"

/**
 * Tinta do rótulo de eixo. Vai no objeto `tick`, NUNCA no `className` do eixo.
 *
 * O recharts 3 desenha os rótulos numa subárvore própria
 * (`recharts-cartesian-axis-tick-labels`, dentro de um `recharts-zIndex-layer`)
 * que NÃO é descendente do `<g>` que recebe o `className` do eixo. Uma classe
 * de `fill` ali pinta um grupo vazio, e o `<text>`, que sai com `fill=""`,
 * herda do `<svg>`: PRETO. Era assim nos dois temas — no claro ninguém
 * reparou, no escuro o eixo sumia. Medido no DOM em 11/09/2026.
 *
 * O caminho que chega ao `<text>` é `tick.className`: o `renderTickItem` do
 * `CartesianAxis` monta o className do zero e só acrescenta o que
 * `getClassNameFromUnknown` extrai do objeto `tick`.
 */
const AXIS_TICK_CLASS = "fill-gray-500 dark:fill-gray-300";

export interface WaterfallChartDatum {
  label: string
  value: number
  type: "total" | "delta"
}

interface WaterfallChartRow extends WaterfallChartDatum {
  start: number
  barValue: number
  runningTotal: number
}

type ChartTextSize = "xs" | "sm" | "md" | "lg" | number

const MIN_WIDTH_PER_BAR = 52

function resolveTextSize(size: ChartTextSize): number {
  if (typeof size === "number") return size
  return { xs: 12, sm: 14, md: 16, lg: 18 }[size]
}

interface WaterfallChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: WaterfallChartDatum[]
  valueFormatter?: (value: number) => string
  showLegend?: boolean
  showTooltip?: boolean
  showGridLines?: boolean
  showConnectors?: boolean
  yAxisWidth?: number
  totalsColor?: ChartColor | string
  additionsColor?: ChartColor | string
  subtractionsColor?: ChartColor | string
  axisTextSize?: ChartTextSize
  labelTruncateAt?: number
  /** Largura mínima por barra; ativa scroll horizontal quando há muitos fatores. */
  minWidthPerBar?: number
}

function buildWaterfallRows(data: WaterfallChartDatum[]): WaterfallChartRow[] {
  let cursor = 0
  return data.map((step) => {
    if (step.type === "total") {
      const start = 0
      cursor = step.value
      return { ...step, start, barValue: step.value, runningTotal: cursor }
    }

    const previous = cursor
    cursor += step.value
    const start = Math.min(previous, cursor)
    const barValue = Math.abs(step.value)
    return { ...step, start, barValue, runningTotal: cursor }
  })
}

/** Extensão real das barras empilhadas (necessária para renderização). */
function computeWaterfallExtent(rows: WaterfallChartRow[]): [number, number] {
  let min = 0
  let max = 0
  for (const row of rows) {
    const bottom = row.start
    const top = row.start + row.barValue
    min = Math.min(min, bottom, top, row.value, row.runningTotal)
    max = Math.max(max, bottom, top, row.value, row.runningTotal)
  }
  return [min, max]
}

function computeNiceYBounds(
  rawMin: number,
  rawMax: number,
  padding = 0.06,
): { domain: [number, number]; ticks: number[] } {
  const range = rawMax - rawMin || Math.max(Math.abs(rawMax), Math.abs(rawMin), 1)
  const pad = range * padding
  const paddedMin = rawMin - pad
  const paddedMax = rawMax + pad
  const ticks = computeNiceTicks(paddedMin, paddedMax, 5, true)
  if (!ticks.length) {
    return { domain: [paddedMin, paddedMax], ticks: [paddedMin, 0, paddedMax] }
  }
  const domain: [number, number] = [
    Math.min(paddedMin, ticks[0]!),
    Math.max(paddedMax, ticks[ticks.length - 1]!),
  ]
  return { domain, ticks: computeNiceTicks(domain[0], domain[1], 5, true) }
}

function truncateLabel(label: string, maxLen?: number) {
  if (!maxLen || label.length <= maxLen) return label
  return `${label.slice(0, maxLen)}…`
}

function WaterfallBarShape({
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  payload,
  totalFill,
  addFill,
  subFill,
}: {
  x?: number
  y?: number
  width?: number
  height?: number
  payload?: WaterfallChartRow
  totalFill: string
  addFill: string
  subFill: string
}) {
  if (!payload || !height || !width) return null

  const fill =
    payload.type === "total" ? totalFill : payload.value >= 0 ? addFill : subFill

  const isTotal = payload.type === "total"
  // Recharts entrega height/width negativos para valores negativos.
  const rectY = height < 0 ? y + height : y
  const rectX = width < 0 ? x + width : x
  const absHeight = Math.abs(height)
  const absWidth = Math.abs(width)
  const barX = isTotal ? rectX - 3 : rectX
  const barWidth = isTotal ? absWidth + 6 : absWidth

  return (
    <rect
      x={barX}
      y={rectY}
      width={barWidth}
      height={absHeight}
      fill={fill}
      rx={0}
      ry={0}
    />
  )
}

function WaterfallConnectors({
  rows,
  xAxisMap,
  yAxisMap,
  offset,
}: {
  rows: WaterfallChartRow[]
  xAxisMap?: Record<string, { scale: { (v: string): number; bandwidth?: () => number } }>
  yAxisMap?: Record<string, { scale: (v: number) => number }>
  offset?: { left?: number; top?: number }
}) {
  const xAxis = xAxisMap ? Object.values(xAxisMap)[0] : undefined
  const yAxis = yAxisMap ? Object.values(yAxisMap)[0] : undefined
  if (!xAxis?.scale || !yAxis?.scale || !offset) return null

  const xScale = xAxis.scale
  const yScale = yAxis.scale
  const bandWidth =
    typeof xScale.bandwidth === "function" ? xScale.bandwidth() : 0
  const left = offset.left ?? 0
  const top = offset.top ?? 0

  const segments: React.ReactNode[] = []
  for (let i = 0; i < rows.length - 1; i++) {
    const curr = rows[i]!
    const next = rows[i + 1]!
    // Conector horizontal clássico: no nível acumulado, da borda direita
    // da barra atual até a borda esquerda da próxima.
    const xCurr = (xScale(curr.label) ?? 0) + bandWidth * 0.85 + left
    const xNext = (xScale(next.label) ?? 0) + bandWidth * 0.15 + left
    const yLevel = yScale(curr.runningTotal) + top

    segments.push(
      <line
        key={`${curr.label}-${next.label}`}
        x1={xCurr}
        y1={yLevel}
        x2={xNext}
        y2={yLevel}
        stroke="currentColor"
        strokeWidth={1}
        strokeDasharray="3 3"
        className="text-gray-400 dark:text-gray-600"
      />,
    )
  }

  return (
    <g className="pointer-events-none" aria-hidden>
      {segments}
    </g>
  )
}

function WaterfallTooltip({
  active,
  payload,
  valueFormatter,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: WaterfallChartRow }>
  valueFormatter: (value: number) => string
}) {
  if (!active || !payload?.[0]?.payload) return null
  const row = payload[0].payload
  const kind =
    row.type === "total" ? "Total" : row.value >= 0 ? "Adição" : "Subtração"

  return (
    <div
      className={cn(
        "rounded-md border text-sm shadow-md",
        "border-gray-200 dark:border-gray-800",
        "bg-white dark:bg-gray-950",
      )}
    >
      <div className="border-b border-inherit px-4 py-2">
        <p className="font-medium text-gray-900 dark:text-gray-50">{row.label}</p>
      </div>
      <div className="space-y-1 px-4 py-2">
        <div className="flex items-center justify-between gap-x-8">
          <p className="text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
            {kind}
          </p>
          <p className="text-right font-medium whitespace-nowrap tabular-nums text-gray-900 dark:text-gray-50">
            {valueFormatter(row.value)}
          </p>
        </div>
        {row.type !== "total" ? (
          <div className="flex items-center justify-between gap-x-8">
            <p className="text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
              Acumulado
            </p>
            <p className="text-right font-medium whitespace-nowrap tabular-nums text-gray-900 dark:text-gray-50">
              {valueFormatter(row.runningTotal)}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function WaterfallChartInner({
  rows,
  valueFormatter,
  showLegend,
  showTooltip,
  showGridLines,
  showConnectors,
  yAxisWidth,
  totalFill,
  addFill,
  subFill,
  resolvedAxisTextSize,
  labelTruncateAt,
  yDomain,
  yTicks,
  scrollable,
  chartMinWidth,
  className,
}: {
  rows: WaterfallChartRow[]
  valueFormatter: (value: number) => string
  showLegend: boolean
  showTooltip: boolean
  showGridLines: boolean
  showConnectors: boolean
  yAxisWidth?: number
  totalFill: string
  addFill: string
  subFill: string
  resolvedAxisTextSize: number
  labelTruncateAt: number
  yDomain: [number, number]
  yTicks: number[]
  scrollable: boolean
  chartMinWidth: number
  className?: string
}) {
  const resolvedYAxisWidth = React.useMemo(() => {
    if (yAxisWidth !== undefined) return yAxisWidth
    const samples = yTicks.map((v) => ({ v }))
    return inferYAxisWidth(samples.length ? samples : [{ v: 0 }], ["v"], valueFormatter)
  }, [yAxisWidth, yTicks, valueFormatter])

  const xAxisHeight = scrollable ? 72 : 64

  const chart = (
    <RechartsBarChart
      data={rows}
      barCategoryGap="20%"
      margin={{ top: 8, right: 12, left: 4, bottom: 4 }}
    >
      {showGridLines ? (
        <CartesianGrid
          className="stroke-gray-200 stroke-1 dark:stroke-gray-800"
          horizontal
          vertical={false}
        />
      ) : null}
      <ReferenceLine
        y={0}
        className="stroke-gray-300 stroke-1 dark:stroke-gray-700"
      />
      <XAxis
        dataKey="label"
        tickLine={false}
        axisLine={false}
        interval={0}
        height={xAxisHeight}
        tickMargin={4}
        angle={scrollable ? -40 : -35}
        textAnchor="end"
        tick={{
          fontSize: resolvedAxisTextSize,
          className: AXIS_TICK_CLASS,
        }}
        fill=""
        stroke=""
        className="text-xs"
        tickFormatter={(label) => truncateLabel(String(label), labelTruncateAt)}
      />
      <YAxis
        width={resolvedYAxisWidth}
        domain={yDomain}
        ticks={yTicks}
        tickLine={false}
        axisLine={false}
        tick={{
          transform: "translate(-3, 0)",
          fontSize: resolvedAxisTextSize,
          className: AXIS_TICK_CLASS,
        }}
        fill=""
        stroke=""
        className="text-xs"
        tickFormatter={valueFormatter}
      />
      {showTooltip ? (
        <Tooltip
          wrapperStyle={{ outline: "none", zIndex: 10 }}
          cursor={{ fill: "rgba(128,128,128,0.08)" }}
          offset={20}
          content={(tp) => (
            <WaterfallTooltip
              active={tp.active}
              payload={tp.payload as ReadonlyArray<{ payload?: WaterfallChartRow }>}
              valueFormatter={valueFormatter}
            />
          )}
        />
      ) : null}

      {showConnectors ? (
        <Customized
          component={(props: {
            xAxisMap?: Record<string, { scale: { (v: string): number; bandwidth?: () => number } }>
            yAxisMap?: Record<string, { scale: (v: number) => number }>
            offset?: { left?: number; top?: number }
          }) => (
            <WaterfallConnectors rows={rows} {...props} />
          )}
        />
      ) : null}

      <Bar dataKey="start" stackId="wf" fill="transparent" isAnimationActive={false} />
      <Bar
        dataKey="barValue"
        stackId="wf"
        maxBarSize={scrollable ? 40 : 36}
        isAnimationActive={false}
        shape={(shapeProps) => (
          <WaterfallBarShape
            {...shapeProps}
            totalFill={totalFill}
            addFill={addFill}
            subFill={subFill}
          />
        )}
      />
    </RechartsBarChart>
  )

  return (
    <div className={cn("flex h-full w-full flex-col", className)}>
      <div
        className={cn(
          "min-h-0 flex-1",
          scrollable ? "overflow-x-auto overflow-y-hidden" : "overflow-hidden",
        )}
      >
        <div
          className="h-full w-full"
          style={{
            /* Largura mínima só como piso: estica até 100% do card e
               ativa scroll apenas quando não couber. */
            minWidth: scrollable ? chartMinWidth : undefined,
          }}
        >
          <MeasuredResponsiveContainer width="100%" height="100%">
            {chart}
          </MeasuredResponsiveContainer>
        </div>
      </div>

      {showLegend ? (
        <div className="mt-2 flex shrink-0 flex-wrap items-center gap-4 text-xs">
          {[
            { label: "Total", color: totalFill },
            { label: "Adições", color: addFill },
            { label: "Subtrações", color: subFill },
          ].map((item) => (
            <div key={item.label} className="inline-flex items-center gap-1.5">
              <span
                className="h-0.75 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const WaterfallChart = React.forwardRef<HTMLDivElement, WaterfallChartProps>(
  (props, ref) => {
    const {
      data,
      className,
      valueFormatter = (value: number) => value.toString(),
      showLegend = true,
      showTooltip = true,
      showGridLines = true,
      showConnectors = true,
      yAxisWidth,
      totalsColor = "blue",
      additionsColor = "emerald",
      subtractionsColor = "red",
      axisTextSize = "xs",
      labelTruncateAt = 12,
      minWidthPerBar = MIN_WIDTH_PER_BAR,
      ...other
    } = props

    const rows = React.useMemo(() => buildWaterfallRows(data), [data])
    const totalFill = chartColorToCss(totalsColor)
    const addFill = chartColorToCss(additionsColor)
    const subFill = chartColorToCss(subtractionsColor)
    const resolvedAxisTextSize = resolveTextSize(axisTextSize)

    const [rawMin, rawMax] = React.useMemo(() => computeWaterfallExtent(rows), [rows])
    const { domain: yDomain, ticks: yTicks } = React.useMemo(
      () => computeNiceYBounds(rawMin, rawMax),
      [rawMin, rawMax],
    )

    const scrollable = rows.length > 7
    const chartMinWidth = rows.length * minWidthPerBar

    return (
      <div ref={ref} className={cn("h-full w-full **:outline-none", className)} {...other}>
        <WaterfallChartInner
          rows={rows}
          valueFormatter={valueFormatter}
          showLegend={showLegend}
          showTooltip={showTooltip}
          showGridLines={showGridLines}
          showConnectors={showConnectors}
          yAxisWidth={yAxisWidth}
          totalFill={totalFill}
          addFill={addFill}
          subFill={subFill}
          resolvedAxisTextSize={resolvedAxisTextSize}
          labelTruncateAt={labelTruncateAt}
          yDomain={yDomain}
          yTicks={yTicks}
          scrollable={scrollable}
          chartMinWidth={chartMinWidth}
          className="h-full"
        />
      </div>
    )
  },
)

WaterfallChart.displayName = "WaterfallChart"
