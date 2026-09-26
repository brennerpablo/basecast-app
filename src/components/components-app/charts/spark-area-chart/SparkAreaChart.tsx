"use client";

import { useId, useMemo } from "react";
// react-doctor-disable-next-line react-doctor/prefer-dynamic-import reason: sparkline is decorative; no layout shift risk at h-10
import {
  Area,
  AreaChart as RechartsAreaChart,
  YAxis,
} from "recharts";

import { cn } from "@/lib/utils";

import {
  type ChartColor,
  chartColorToCss,
  constructCategoryColors,
} from "../utils/chartColors";
import { MeasuredResponsiveContainer } from "../utils/MeasuredResponsiveContainer";

export interface SparkAreaChartProps {
  data: Record<string, unknown>[];
  index: string;
  categories: string[];
  colors?: (ChartColor | string)[];
  /** Gradiente sob a linha — padrão Tremor/app (family-card). */
  showGradient?: boolean;
  /** Espessura da linha — alinhada ao TrendCard (`strokeWidth={2}`). */
  strokeWidth?: number;
  className?: string;
}

function resolveDomain(
  data: Record<string, unknown>[],
  categories: string[],
): [number, number] | undefined {
  const values = categories.flatMap((category) =>
    data
      .map((row) => Number(row[category]))
      .filter((value) => Number.isFinite(value)),
  );

  if (values.length === 0) return undefined;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const padding = span > 0 ? span * 0.12 : Math.max(Math.abs(max) * 0.05, 0.5);

  return [min - padding, max + padding];
}

/**
 * Sparkline compacta inspirada no Tremor `SparkAreaChart`, renderizada com
 * Recharts no mesmo estilo dos mini-gráficos do app (tesouro / BI trend).
 */
export function SparkAreaChart({
  data,
  index: _index,
  categories,
  colors = ["emerald"],
  showGradient = true,
  strokeWidth = 2,
  className,
}: SparkAreaChartProps) {
  const baseId = useId();
  const categoryColors = useMemo(
    () => constructCategoryColors(categories, colors),
    [categories, colors],
  );
  const yDomain = useMemo(() => resolveDomain(data, categories), [data, categories]);

  if (data.length < 2) {
    return <div className={cn("h-full w-full rounded bg-muted/40", className)} />;
  }

  return (
    <div className={cn("h-full w-full", className)}>
      <MeasuredResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart
          data={data}
          margin={{ top: 4, right: 1, left: 1, bottom: 0 }}
        >
          {yDomain ? <YAxis hide domain={yDomain} /> : null}
          <defs>
            {categories.map((category) => {
              const stroke = chartColorToCss(categoryColors.get(category) ?? colors[0]);
              return (
                <linearGradient
                  key={category}
                  id={`${baseId}-${category}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={stroke}
                    stopOpacity={showGradient ? 0.35 : 0}
                  />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {categories.map((category) => {
            const stroke = chartColorToCss(categoryColors.get(category) ?? colors[0]);
            return (
              <Area
                key={category}
                type="monotone"
                dataKey={category}
                stroke={stroke}
                strokeWidth={strokeWidth}
                fill={showGradient ? `url(#${baseId}-${category})` : "none"}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            );
          })}
        </RechartsAreaChart>
      </MeasuredResponsiveContainer>
    </div>
  );
}
