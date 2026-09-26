// DonutChart — adapted from Tremor DonutChart v1.0.0

"use client"

import React from "react"
import {
  Pie,
  PieChart as ReChartsDonutChart,
  Sector,
  Tooltip} from "recharts"

import { cn } from "@/lib/utils"

import {
  CHART_COLORS,
  type ChartColor,
  constructCategoryColors,
  getColorClass,
  isHexColor} from "../utils/chartColors"
import { MeasuredResponsiveContainer } from "../utils/MeasuredResponsiveContainer"

const sumNumericArray = (arr: number[]): number =>
  arr.reduce((sum, num) => sum + num, 0)

const parseData = (
  data: Record<string, any>[],
  categoryColors: Map<string, ChartColor | string>,
  category: string,
) =>
  data.map((dataPoint) => {
    const color = categoryColors.get(dataPoint[category]) || CHART_COLORS[0]
    const hex = isHexColor(color as string)
    return {
      ...dataPoint,
      color,
      className: hex ? undefined : getColorClass(color as ChartColor, "fill"),
      fill: hex ? color : undefined}
  })

const calculateDefaultLabel = (data: any[], valueKey: string): number =>
  sumNumericArray(data.map((dataPoint) => dataPoint[valueKey]))

const parseLabelInput = (
  labelInput: string | undefined,
  valueFormatter: (value: number) => string,
  data: any[],
  valueKey: string,
): string => labelInput || valueFormatter(calculateDefaultLabel(data, valueKey))

//#region Tooltip

type TooltipProps = Pick<ChartTooltipProps, "active" | "payload">

type PayloadItem = {
  category: string
  value: number
  color: ChartColor | string
}

interface ChartTooltipProps {
  active: boolean | undefined
  payload: PayloadItem[]
  valueFormatter: (value: number) => string
}

const ChartTooltip = ({
  active,
  payload,
  valueFormatter}: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div
        className={cn(
          "rounded-md border text-sm shadow-md",
          "border-gray-200 dark:border-gray-800",
          "bg-white dark:bg-gray-950",
        )}
      >
        <div className="space-y-1 px-4 py-2">
          {payload.map(({ value, category, color }, index) => {
            const hex = isHexColor(color as string)
            return (
            <div
              key={`id-${index}`}
              className="flex items-center justify-between gap-x-8"
            >
              <div className="flex items-center gap-x-2">
                <span
                  aria-hidden="true"
                  className={cn("size-2 shrink-0 rounded-full", hex ? undefined : getColorClass(color as ChartColor, "bg"))}
                  style={hex ? { backgroundColor: color as string } : undefined}
                />
                <p className="whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
                  {category}
                </p>
              </div>
              <p className="whitespace-nowrap text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
                {valueFormatter(value)}
              </p>
            </div>
          )})}
        </div>
      </div>
    )
  }
  return null
}

const renderInactiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, className, fill } = props
  const useHex = fill && isHexColor(fill)
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      className={useHex ? undefined : className}
      fill={useHex ? fill : ""}
      opacity={0.3}
      style={{ outline: "none" }}
    />
  )
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, className, fill } = props
  const useHex = fill && isHexColor(fill)
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 4}
      startAngle={startAngle}
      endAngle={endAngle}
      className={useHex ? undefined : className}
      fill={useHex ? fill : ""}
      style={{ outline: "none" }}
    />
  )
}

//#region Legend

type LegendPosition = "top" | "bottom" | "left" | "right"

interface ChartLegendProps {
  data: Record<string, any>[]
  category: string
  value: string
  categoryColors: Map<string, ChartColor | string>
  valueFormatter: (value: number) => string
  position: LegendPosition
}

const ChartLegend = ({
  data,
  category,
  value,
  categoryColors,
  valueFormatter,
  position}: ChartLegendProps) => {
  const isHorizontal = position === "top" || position === "bottom"
  return (
    <div
      className={cn(
        "flex gap-x-6 gap-y-2",
        isHorizontal
          ? "flex-row flex-wrap justify-center"
          : "flex-col justify-center",
      )}
    >
      {data.map((item, index) => {
        const cat = item[category]
        const val = item[value]
        const color = categoryColors.get(cat) || CHART_COLORS[0]
        const hex = isHexColor(color as string)
        return (
          <div key={index} className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className={cn("size-2 shrink-0 rounded-full", hex ? undefined : getColorClass(color as ChartColor, "bg"))}
              style={hex ? { backgroundColor: color as string } : undefined}
            />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {cat}
            </span>
            <span className="text-sm font-medium tabular-nums whitespace-nowrap">
              {valueFormatter(val)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

//#region DonutChart

type BaseEventProps = {
  eventType: "sector"
  categoryClicked: string
  [key: string]: number | string
}

type DonutChartEventProps = BaseEventProps | null | undefined

interface DonutChartProps extends React.HTMLAttributes<HTMLDivElement> {
  data: Record<string, any>[]
  category: string
  value: string
  colors?: (ChartColor | string)[]
  /** 0 = thin ring, 100 = solid pie. Default 25. */
  thickness?: number
  valueFormatter?: (value: number) => string
  label?: string
  showLabel?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  legendPosition?: LegendPosition
  onValueChange?: (value: DonutChartEventProps) => void
  tooltipCallback?: (tooltipCallbackContent: TooltipProps) => void
  customTooltip?: React.ComponentType<TooltipProps>
}

const DonutChart = React.forwardRef<HTMLDivElement, DonutChartProps>(
  (
    {
      data = [],
      value,
      category,
      colors = [...CHART_COLORS],
      thickness = 25,
      valueFormatter = (value: number) => value.toString(),
      label,
      showLabel = false,
      showTooltip = true,
      showLegend = false,
      legendPosition = "right",
      onValueChange,
      tooltipCallback,
      customTooltip,
      className,
      ...other
    },
    forwardedRef,
  ) => {
    const CustomTooltip = customTooltip
    const [activeIndex, setActiveIndex] = React.useState<number | undefined>(undefined)
    const [hoveredIndex, setHoveredIndex] = React.useState<number | undefined>(undefined)
    const innerRadius = `${100 - Math.min(100, Math.max(0, thickness))}%`
    const hasHole = thickness < 100
    const parsedLabelInput = parseLabelInput(label, valueFormatter, data, value)

    const categories = Array.from(new Set(data.map((item) => item[category])))
    const categoryColors = constructCategoryColors(categories, [...colors])

    const prevActiveRef = React.useRef<boolean | undefined>(undefined)
    const prevCategoryRef = React.useRef<string | undefined>(undefined)

    const handleShapeClick = (data: any, index: number, event: React.MouseEvent) => {
      event.stopPropagation()
      if (!onValueChange) return
      if (activeIndex === index) {
        setActiveIndex(undefined)
        onValueChange(null)
      } else {
        setActiveIndex(index)
        onValueChange({
          eventType: "sector",
          categoryClicked: data.payload[category],
          ...data.payload})
      }
    }

    const isHorizontalLegend = legendPosition === "top" || legendPosition === "bottom"

    const pieChart = (
      <MeasuredResponsiveContainer className="size-full">
        <ReChartsDonutChart
          onClick={
            onValueChange && activeIndex !== undefined
              ? () => { setActiveIndex(undefined); onValueChange(null) }
              : undefined
          }
          margin={{ top: 5, left: 5, right: 5, bottom: 5 }}
        >
          {showLabel && hasHole && (
            <text
              className="fill-gray-700 dark:fill-gray-300"
              x="50%"
              y="50%"
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {parsedLabelInput}
            </text>
          )}
          <Pie
            className={cn(
              "stroke-white dark:stroke-gray-950 [&_.recharts-pie-sector]:outline-none",
              onValueChange ? "cursor-pointer" : "cursor-default",
            )}
            data={parseData(data, categoryColors, category)}
            cx="50%"
            cy="50%"
            startAngle={90}
            endAngle={-270}
            innerRadius={innerRadius}
            outerRadius="100%"
            stroke=""
            strokeLinejoin="round"
            dataKey={value}
            nameKey={category}
            isAnimationActive={false}
            onClick={handleShapeClick}
            onMouseEnter={(_: any, index: number) => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(undefined)}
            {...({ activeIndex: activeIndex !== undefined ? activeIndex : hoveredIndex } as any)}
            activeShape={renderActiveShape}
            inactiveShape={activeIndex !== undefined ? renderInactiveShape : undefined}
            style={{ outline: "none" }}
          />
          {showTooltip && (
            <Tooltip
              wrapperStyle={{ outline: "none" }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const cleanPayload = payload
                  ? payload.map((item: any) => ({
                      category: item.payload[category],
                      value: item.value,
                      color: categoryColors.get(item.payload[category]) as ChartColor | string}))
                  : []

                const payloadCategory: string = cleanPayload[0]?.category

                if (
                  tooltipCallback &&
                  (active !== prevActiveRef.current ||
                    payloadCategory !== prevCategoryRef.current)
                ) {
                  tooltipCallback({ active, payload: cleanPayload })
                  prevActiveRef.current = active
                  prevCategoryRef.current = payloadCategory
                }

                return showTooltip && active ? (
                  CustomTooltip ? (
                    <CustomTooltip active={active} payload={cleanPayload} />
                  ) : (
                    <ChartTooltip
                      active={active}
                      payload={cleanPayload}
                      valueFormatter={valueFormatter}
                    />
                  )
                ) : null
              }}
            />
          )}
        </ReChartsDonutChart>
      </MeasuredResponsiveContainer>
    )

    if (!showLegend) {
      return (
        <div
          ref={forwardedRef}
          className={cn("min-h-40 h-full aspect-square **:outline-none", className)}
          {...other}
        >
          {pieChart}
        </div>
      )
    }

    const legendEl = (
      <ChartLegend
        data={data}
        category={category}
        value={value}
        categoryColors={categoryColors}
        valueFormatter={valueFormatter}
        position={legendPosition}
      />
    )

    return (
      <div
        ref={forwardedRef}
        className={cn(
          "flex overflow-hidden **:outline-none",
          isHorizontalLegend
            ? "flex-col items-center gap-4"
            : "flex-row items-center gap-6",
        )}
        {...other}
      >
        {(legendPosition === "top" || legendPosition === "left") && legendEl}
        <div className={cn("min-h-40 h-full aspect-square", className)}>{pieChart}</div>
        {(legendPosition === "bottom" || legendPosition === "right") && legendEl}
      </div>
    )
  },
)

DonutChart.displayName = "DonutChart"

export {
  DonutChart,
  type DonutChartEventProps,
  type LegendPosition,
  type TooltipProps}
