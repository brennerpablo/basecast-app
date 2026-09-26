"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import {
  CHART_COLORS,
  type ChartColor,
  constructCategoryColors,
  getColorClass,
  isHexColor} from "../utils/chartColors";

export interface CompositionBarProps extends Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "children"
> {
  data: Record<string, any>[];
  category: string;
  value: string;
  colors?: (ChartColor | string)[];
  valueFormatter?: (value: number) => string;
  percentFormatter?: (percent: number) => string;
  sortOrder?: "ascending" | "descending" | "none";
  barHeight?: number;
  /** Floor (in percent) applied to rendered segment widths so tiny slices stay visible. */
  minSegmentPercent?: number;
  showLegend?: boolean;
  showTooltip?: boolean;
  /**
   * When `true`, the component stretches to fill its parent's height and the
   * legend rows are distributed evenly across the available vertical space.
   * Use inside fixed-height cards so the chart visually balances with siblings.
   */
  fillParent?: boolean;
  /** Optional override label rendered when `data` is empty or all values are zero. */
  emptyLabel?: string;
}

interface Row {
  key: string;
  value: number;
  percent: number;
  renderedWidth: number;
  color: ChartColor | string;
  hex: boolean;
}

const defaultPercentFormatter = (p: number): string => `${p.toFixed(1)}%`;
const defaultValueFormatter = (v: number): string => v.toString();

function buildRows(
  data: Record<string, any>[],
  category: string,
  value: string,
  colors: (ChartColor | string)[],
  sortOrder: "ascending" | "descending" | "none",
  minSegmentPercent: number,
): { rows: Row[]; total: number } {
  const items = data
    .map((d) => ({
      key: String(d[category] ?? ""),
      value: Number(d[value] ?? 0)}))
    .filter((d) => Number.isFinite(d.value));

  const ordered =
    sortOrder === "none"
      ? items
      : [...items].sort((a, b) =>
          sortOrder === "ascending" ? a.value - b.value : b.value - a.value,
        );

  const total = ordered.reduce((s, r) => s + r.value, 0);
  if (total <= 0) return { rows: [], total: 0 };

  const categoryColors = constructCategoryColors(
    ordered.map((r) => r.key),
    colors,
  );

  // Compute true percentages, then inflate any below `minSegmentPercent`
  // and reclaim the excess from the largest segment so widths still sum to 100.
  const truePercents = ordered.map((r) => (r.value / total) * 100);
  const renderedRaw = truePercents.map((p) =>
    p > 0 && p < minSegmentPercent ? minSegmentPercent : p,
  );
  const inflation = renderedRaw.reduce((s, w) => s + w, 0) - 100;
  if (inflation > 0) {
    let largestIdx = 0;
    for (let i = 1; i < renderedRaw.length; i++) {
      if (renderedRaw[i] > renderedRaw[largestIdx]) largestIdx = i;
    }
    renderedRaw[largestIdx] = Math.max(0, renderedRaw[largestIdx] - inflation);
  }

  const rows: Row[] = ordered.map((r, i) => {
    const color = categoryColors.get(r.key) ?? CHART_COLORS[0];
    return {
      key: r.key,
      value: r.value,
      percent: truePercents[i],
      renderedWidth: renderedRaw[i],
      color,
      hex: isHexColor(String(color))};
  });

  return { rows, total };
}

interface ChartTooltipProps {
  row: Row;
  valueFormatter: (value: number) => string;
  percentFormatter: (percent: number) => string;
}

const ChartTooltip = ({
  row,
  valueFormatter,
  percentFormatter}: ChartTooltipProps) => {
  const { key, value, percent, color, hex } = row;
  return (
    <div
      className={cn(
        "rounded-md border text-sm shadow-md",
        "border-gray-200 dark:border-gray-800",
        "bg-white dark:bg-gray-950",
      )}
    >
      <div className="border-b border-inherit px-4 py-2">
        <p className="font-medium text-gray-900 dark:text-gray-50">{key}</p>
      </div>
      <div className="space-y-1 px-4 py-2">
        <div className="flex items-center justify-between gap-x-8">
          <div className="flex items-center gap-x-2">
            <span
              aria-hidden="true"
              className={cn(
                "h-0.75 w-3.5 shrink-0 rounded-full",
                !hex && getColorClass(color as ChartColor, "bg"),
              )}
              style={hex ? { backgroundColor: color as string } : undefined}
            />
            <p className="whitespace-nowrap text-right text-gray-700 dark:text-gray-300">
              Total
            </p>
          </div>
          <p className="whitespace-nowrap text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {valueFormatter(value)}
          </p>
        </div>
        <div className="flex items-center justify-between gap-x-8">
          <p className="whitespace-nowrap text-right text-gray-700 dark:text-gray-300 pl-5.5">
            Participação
          </p>
          <p className="whitespace-nowrap text-right font-medium tabular-nums text-gray-900 dark:text-gray-50">
            {percentFormatter(percent)}
          </p>
        </div>
      </div>
    </div>
  );
};

const CompositionBar = React.forwardRef<HTMLDivElement, CompositionBarProps>(
  (props, ref) => {
    const {
      data,
      category,
      value,
      colors = [...CHART_COLORS],
      valueFormatter = defaultValueFormatter,
      percentFormatter = defaultPercentFormatter,
      sortOrder = "none",
      barHeight = 12,
      minSegmentPercent = 0.5,
      showLegend = true,
      showTooltip = true,
      fillParent = false,
      emptyLabel,
      className,
      ...rest
    } = props;

    const { rows, total } = React.useMemo(
      () =>
        buildRows(data, category, value, colors, sortOrder, minSegmentPercent),
      [data, category, value, colors, sortOrder, minSegmentPercent],
    );

    const barWrapperRef = React.useRef<HTMLDivElement | null>(null);
    const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);
    const [tooltipPos, setTooltipPos] = React.useState<{
      left: number;
      top: number;
    }>({ left: 0, top: 0 });

    const handleMove = React.useCallback(
      (idx: number) => (e: React.MouseEvent<HTMLDivElement>) => {
        if (!showTooltip) return;
        const wrap = barWrapperRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        setTooltipPos({
          left: e.clientX - rect.left,
          top: -8});
        setHoveredIdx(idx);
      },
      [showTooltip],
    );

    const handleLeave = React.useCallback(() => {
      setHoveredIdx(null);
    }, []);

    if (total === 0) {
      return (
        <div
          ref={ref}
          className={cn(
            "w-full",
            fillParent && "flex h-full flex-col",
            className,
          )}
          {...rest}
        >
          <div
            className="w-full rounded-md bg-gray-100 dark:bg-gray-800"
            style={{ height: barHeight }}
          />
          {emptyLabel && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {emptyLabel}
            </p>
          )}
        </div>
      );
    }

    const hovered = hoveredIdx !== null ? rows[hoveredIdx] : null;

    return (
      <div
        ref={ref}
        className={cn(
          "w-full",
          fillParent && "flex h-full flex-col",
          className,
        )}
        {...rest}
      >
        <div
          ref={barWrapperRef}
          className="relative"
          onMouseLeave={handleLeave}
        >
          <div
            className="flex w-full overflow-hidden rounded-md"
            style={{ height: barHeight }}
            role="img"
            aria-label={rows
              .map((r) => `${r.key}: ${percentFormatter(r.percent)}`)
              .join(", ")}
          >
            {rows.map((r, idx) => (
              <div
                key={r.key}
                className={cn(
                  "transition-opacity duration-150",
                  !r.hex && getColorClass(r.color as ChartColor, "bg"),
                  hoveredIdx !== null && hoveredIdx !== idx && "opacity-40",
                )}
                style={{
                  width: `${r.renderedWidth}%`,
                  backgroundColor: r.hex ? (r.color as string) : undefined}}
                onMouseEnter={handleMove(idx)}
                onMouseMove={handleMove(idx)}
              />
            ))}
          </div>

          {showTooltip && hovered && (
            <div
              className="pointer-events-none absolute z-50 -translate-x-1/2 -translate-y-full"
              style={{ left: tooltipPos.left, top: tooltipPos.top }}
            >
              <ChartTooltip
                row={hovered}
                valueFormatter={valueFormatter}
                percentFormatter={percentFormatter}
              />
            </div>
          )}
        </div>

        {showLegend && (
          <ul
            className={cn(
              "mt-4",
              fillParent ? "flex flex-1 flex-col justify-around" : "space-y-2",
            )}
          >
            {rows.map((r, idx) => (
              <li
                key={r.key}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 transition-opacity duration-150",
                  hoveredIdx !== null && hoveredIdx !== idx && "opacity-40",
                )}
                onMouseEnter={() => showTooltip && setHoveredIdx(idx)}
                onMouseLeave={handleLeave}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-3 shrink-0 rounded-sm",
                    !r.hex && getColorClass(r.color as ChartColor, "bg"),
                  )}
                  style={
                    r.hex ? { backgroundColor: r.color as string } : undefined
                  }
                />
                <span
                  className="truncate text-sm text-gray-700 dark:text-gray-200"
                  title={r.key}
                >
                  {r.key}
                </span>
                <span className="whitespace-nowrap text-sm tabular-nums text-gray-500 dark:text-gray-400">
                  {valueFormatter(r.value)}
                </span>
                <span className="w-14 whitespace-nowrap text-right text-sm tabular-nums text-gray-500 dark:text-gray-400">
                  {percentFormatter(r.percent)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);

CompositionBar.displayName = "CompositionBar";

export { CompositionBar };
