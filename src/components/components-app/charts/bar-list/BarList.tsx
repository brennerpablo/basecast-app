// Tremor BarList [v0.1.1] — local implementation (no @tremor package).
// Visual and behavior aligned with Tremor raw; `cn` + ChartColor bar variants.

"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

import type { ChartColor } from "../utils/chartColors";

export type Bar<T = unknown> = T & {
  key?: string;
  href?: string;
  value: number;
  name: string;
  /** Tooltip nativo quando `name` é truncado externamente (ex.: var-assets). */
  labelTitle?: string;
};

/** Light bar + dark bar + hover (Tremor-style) per chart color. */
const barRowStyles: Record<
  ChartColor,
  { base: string; interactiveHover: string }
> = {
  blue: {
    base: "bg-blue-200 dark:bg-blue-900",
    interactiveHover:
      "group-hover:bg-blue-300 group-hover:dark:bg-blue-800"},
  emerald: {
    base: "bg-emerald-300 dark:bg-emerald-800",
    interactiveHover:
      "group-hover:bg-emerald-400 group-hover:dark:bg-emerald-700"},
  red: {
    base: "bg-red-200 dark:bg-red-900",
    interactiveHover:
      "group-hover:bg-red-300 group-hover:dark:bg-red-800"},
  violet: {
    base: "bg-violet-200 dark:bg-violet-900",
    interactiveHover:
      "group-hover:bg-violet-300 group-hover:dark:bg-violet-800"},
  amber: {
    base: "bg-amber-200 dark:bg-amber-900",
    interactiveHover:
      "group-hover:bg-amber-300 group-hover:dark:bg-amber-800"},
  rose: {
    base: "bg-rose-200 dark:bg-rose-900",
    interactiveHover:
      "group-hover:bg-rose-300 group-hover:dark:bg-rose-800"},
  orange: {
    base: "bg-orange-200 dark:bg-orange-900",
    interactiveHover:
      "group-hover:bg-orange-300 group-hover:dark:bg-orange-800"},
  teal: {
    base: "bg-teal-200 dark:bg-teal-900",
    interactiveHover:
      "group-hover:bg-teal-300 group-hover:dark:bg-teal-800"},
  cyan: {
    base: "bg-cyan-200 dark:bg-cyan-900",
    interactiveHover:
      "group-hover:bg-cyan-300 group-hover:dark:bg-cyan-800"},
  pink: {
    base: "bg-pink-200 dark:bg-pink-900",
    interactiveHover:
      "group-hover:bg-pink-300 group-hover:dark:bg-pink-800"},
  indigo: {
    base: "bg-indigo-200 dark:bg-indigo-900",
    interactiveHover:
      "group-hover:bg-indigo-300 group-hover:dark:bg-indigo-800"}};

export interface BarListProps<T = unknown>
  extends React.HTMLAttributes<HTMLDivElement> {
  data: Bar<T>[];
  valueFormatter?: (value: number) => string;
  showAnimation?: boolean;
  onValueChange?: (payload: Bar<T>) => void;
  sortOrder?: "ascending" | "descending" | "none";
  /** Bar fill palette (default `blue`, Tremor raw default). */
  color?: ChartColor;
  /**
   * When `true`, label is clipped to the bar width (Tremor raw).
   * When `false` (default), bar is a background layer and the full name/value text is shown.
   */
  truncateLabel?: boolean;
  /**
   * Compact mode — shrinks row height and gaps for dense lists (>~10 rows).
   */
  dense?: boolean;
}

function BarListInner<T>(
  {
    data = [],
    valueFormatter = (value: number) => value.toString(),
    showAnimation = false,
    onValueChange,
    sortOrder = "descending",
    color = "blue",
    truncateLabel = false,
    dense = false,
    className,
    ...props
  }: BarListProps<T>,
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
) {
  const rowHeight = dense ? "h-6" : "h-8";
  const rowGap = dense ? "space-y-1" : "space-y-1.5";
  const valueGap = dense ? "mb-1" : "mb-1.5";
  const sortedData = React.useMemo(() => {
    if (sortOrder === "none") {
      return data;
    }
    return [...data].sort((a, b) =>
      sortOrder === "ascending" ? a.value - b.value : b.value - a.value,
    );
  }, [data, sortOrder]);

  const widths = React.useMemo(() => {
    const maxValue = Math.max(...sortedData.map((item) => item.value), 0);
    return sortedData.map((item) =>
      item.value === 0 ? 0 : Math.max((item.value / maxValue) * 100, 2),
    );
  }, [sortedData]);

  const styles = barRowStyles[color] ?? barRowStyles.blue;

  const nameEl = (item: Bar<T>, truncated: boolean, stopLinkPropagation: boolean) => {
    const tip = item.labelTitle?.trim();
    const titleProps = tip ? ({ title: tip } as const) : {};
    const linkCls = cn(
      "rounded text-sm text-gray-900 outline-hidden hover:underline hover:underline-offset-2 dark:text-gray-50",
      "focus-visible:ring-2 focus-visible:ring-ring",
      truncated ? "truncate whitespace-nowrap" : "whitespace-nowrap",
    );
    const textCls = cn(
      "text-sm text-gray-900 dark:text-gray-50",
      truncated ? "truncate whitespace-nowrap" : "whitespace-nowrap",
    );
    if (item.href) {
      return (
        <a
          href={item.href}
          className={linkCls}
          target="_blank"
          rel="noreferrer"
          onClick={stopLinkPropagation ? (e) => e.stopPropagation() : undefined}
          {...titleProps}
        >
          {item.name}
        </a>
      );
    }
    return (
      <p className={textCls} {...titleProps}>
        {item.name}
      </p>
    );
  };

  const barFillClass = cn(
    "absolute inset-y-0 left-0 z-0 rounded transition-all",
    rowHeight,
    styles.base,
    onValueChange && styles.interactiveHover,
    showAnimation && "duration-800",
  );

  /** Rótulo à esquerda não invade a coluna de valores (modo barra de fundo). */
  const nameRowOverlayClass = cn(
    "relative z-10 flex h-full w-full min-w-0 items-center overflow-hidden pl-2 pr-1",
    rowHeight,
  );
  const nameOverlayWrapClass = "min-w-0 max-w-full";

  return (
    <div
      ref={forwardedRef}
      data-slot="bar-list"
      className={cn("flex justify-between space-x-6", className)}
      aria-sort={sortOrder}
      {...props}
    >
      <div className={cn("relative min-w-0 flex-1 overflow-x-visible", rowGap)}>
        {sortedData.map((item, index) => {
          const key = item.key ?? item.name;
          const w = widths[index];

          if (truncateLabel) {
            if (onValueChange) {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onValueChange(item)}
                  className={cn(
                    "group w-full rounded text-left outline-hidden",
                    "focus-visible:ring-2 focus-visible:ring-ring",
                    "m-0! cursor-pointer hover:bg-gray-50 hover:dark:bg-gray-900",
                  )}
                >
                  <div
                    className={cn(
                      "relative flex max-w-full items-center rounded transition-all",
                      rowHeight,
                      styles.base,
                      styles.interactiveHover,
                      index === sortedData.length - 1 ? "mb-0" : undefined,
                      showAnimation && "duration-800",
                    )}
                    style={{ width: `${w}%` }}
                  >
                    <div className="absolute left-2 flex min-w-0 max-w-[calc(100%-0.5rem)] pr-2">
                      {nameEl(item, true, true)}
                    </div>
                  </div>
                </button>
              );
            }
            return (
              <div key={key} className="group w-full rounded">
                <div
                  className={cn(
                    "relative flex max-w-full items-center rounded transition-all",
                    rowHeight,
                    styles.base,
                    index === sortedData.length - 1 ? "mb-0" : undefined,
                    showAnimation && "duration-800",
                  )}
                  style={{ width: `${w}%` }}
                >
                  <div className="absolute left-2 flex min-w-0 max-w-[calc(100%-0.5rem)] pr-2">
                    {nameEl(item, true, false)}
                  </div>
                </div>
              </div>
            );
          }

          /* Full label: bar as underlay; text spans row width */
          if (onValueChange) {
            return (
              <button
                key={key}
                type="button"
                onClick={() => onValueChange(item)}
                className={cn(
                  "group relative w-full overflow-visible rounded text-left outline-hidden",
                  "focus-visible:ring-2 focus-visible:ring-ring",
                  "m-0! cursor-pointer hover:bg-gray-50 hover:dark:bg-gray-900",
                  rowHeight,
                )}
              >
                <div
                  className={barFillClass}
                  style={{ width: `${w}%` }}
                  aria-hidden
                />
                <div className={nameRowOverlayClass}>
                  <div className={nameOverlayWrapClass}>
                    {nameEl(item, true, true)}
                  </div>
                </div>
              </button>
            );
          }
          return (
            <div
              key={key}
              className={cn(
                "group relative w-full min-w-0 overflow-hidden rounded",
                rowHeight,
              )}
            >
              <div className={barFillClass} style={{ width: `${w}%` }} aria-hidden />
              <div className={nameRowOverlayClass}>
                <div className={nameOverlayWrapClass}>
                  {nameEl(item, true, false)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="min-w-19 shrink-0 overflow-hidden">
        {sortedData.map((item, index) => (
          <div
            key={item.key ?? item.name}
            className={cn(
              "flex items-center justify-end",
              rowHeight,
              index === sortedData.length - 1 ? "mb-0" : valueGap,
            )}
          >
            <p
              className={cn(
                "text-sm leading-none text-gray-900 dark:text-gray-50",
                truncateLabel
                  ? "truncate whitespace-nowrap"
                  : "whitespace-nowrap text-right",
              )}
            >
              {valueFormatter(item.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

BarListInner.displayName = "BarList";

export const BarList = React.forwardRef(BarListInner) as <T = unknown>(
  p: BarListProps<T> & React.RefAttributes<HTMLDivElement>,
) => React.ReactElement;
