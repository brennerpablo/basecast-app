"use client";

import type * as React from "react";
import { useCallback, useState } from "react";

import { useTheme } from "@/lib/hooks/use-theme";
import { cn } from "@/lib/utils";

import type { Mode } from "./palette";

/**
 * The pieces the backtest charts share. recharts draws the frame (grid, axes); the marks are drawn by a
 * layer that reads the axis scales, so each mark gets a 24 px hit target, keyboard focus and one HTML
 * readout (value first, then what it is).
 */

export function useMode(): Mode {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}

/** Axis ink: on the `tick` object (recharts 3 draws tick labels outside the axis's own `<g>`). */
export const AXIS_TICK = { fontSize: 12, className: "fill-muted-foreground" };
export const AXIS_LINE = { className: "stroke-border" };
export const GRID_CLASS = "stroke-border/60";

/** The surface ring of a mark: the card's color, so a dot stays legible where it crosses another mark. */
export const RING = { stroke: "hsl(var(--card))", strokeWidth: 2 };

export type Swatch = "dot" | "square" | "diamond" | "hollow" | "bar" | "rect" | "line" | "dashed" | "whisker";

export type Readout = {
  title: string;
  rows: { swatch?: Swatch; color?: string; label: string; value: string }[];
  notes?: string[];
};

export type Hover = { key: string; x: number; y: number; flip: boolean; readout: Readout };

/** The hovered or focused mark, one per chart. */
export function useHover() {
  const [hover, setHover] = useState<Hover | null>(null);
  const clear = useCallback((key: string) => setHover((h) => (h?.key === key ? null : h)), []);
  return { hover, setHover, clear };
}

/** A small key drawn like its mark: a stroke for lines, a dot, square or diamond for points, a bar for ranges. */
export function SwatchIcon({ swatch, color, className }: { swatch: Swatch; color: string; className?: string }) {
  return (
    <svg aria-hidden width={16} height={12} viewBox="0 0 16 12" className={cn("shrink-0", className)}>
      {swatch === "dot" && <circle cx={8} cy={6} r={4} fill={color} />}
      {swatch === "hollow" && <circle cx={8} cy={6} r={3.5} fill="none" stroke={color} strokeWidth={2} />}
      {swatch === "square" && <rect x={4} y={2} width={8} height={8} rx={1.5} fill={color} />}
      {swatch === "diamond" && <path d="M8 1 L13 6 L8 11 L3 6 Z" fill={color} />}
      {swatch === "bar" && <rect x={5} y={0} width={6} height={12} rx={2} fill={color} fillOpacity={0.35} />}
      {swatch === "rect" && <rect x={1} y={3} width={14} height={6} rx={2} fill={color} />}
      {swatch === "line" && <line x1={1} y1={6} x2={15} y2={6} stroke={color} strokeWidth={2} strokeLinecap="round" />}
      {swatch === "dashed" && <line x1={1} y1={6} x2={15} y2={6} stroke={color} strokeWidth={2} strokeDasharray="3 2" />}
      {swatch === "whisker" && (
        <g stroke={color} strokeWidth={2} strokeLinecap="round">
          <line x1={8} y1={1} x2={8} y2={11} />
          <line x1={5} y1={1} x2={11} y2={1} />
          <line x1={5} y1={11} x2={11} y2={11} />
        </g>
      )}
    </svg>
  );
}

export type LegendItem = { key: string; label: React.ReactNode; swatch: Swatch; color: string };

/** The chart's legend: a key per series, text in ink (never in the series color). */
export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)}>
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <SwatchIcon swatch={item.swatch} color={item.color} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** The chart's box, with the readout of the hovered mark floating beside it. */
export function ChartFrame({
  hover,
  className,
  label,
  children,
}: {
  hover: Hover | null;
  className?: string;
  /** The chart's accessible name. */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div role="figure" aria-label={label} className={cn("relative", className)}>
      {children}
      {hover && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 w-max max-w-72 rounded-md border border-border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
          style={{
            left: hover.x,
            top: hover.y,
            transform: hover.flip ? "translate(calc(-100% - 14px), -50%)" : "translate(14px, -50%)",
          }}
        >
          <p className="mb-1 font-medium text-foreground">{hover.readout.title}</p>
          <div className="space-y-0.5">
            {hover.readout.rows.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-x-4">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  {row.swatch && row.color && <SwatchIcon swatch={row.swatch} color={row.color} />}
                  {row.label}
                </span>
                <span className="font-medium whitespace-nowrap text-foreground tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
          {hover.readout.notes?.map((note) => (
            <p key={note} className="mt-1 text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * A focusable mark: a transparent hit target of at least 24 px around what it draws, the readout on hover
 * and focus, and an ink ring while active.
 */
export function Mark({
  id,
  x,
  y,
  hit,
  label,
  readout,
  hover,
  onHover,
  onLeave,
  plotMid,
  ring = 9,
  children,
}: {
  id: string;
  x: number;
  y: number;
  /** A rectangular hit area, for tall marks (a range); a 12 px radius around (x, y) otherwise. */
  hit?: { x: number; y: number; width: number; height: number };
  label: string;
  readout: Readout;
  hover: Hover | null;
  onHover: (hover: Hover) => void;
  onLeave: (key: string) => void;
  /** Past this x the readout opens to the left. */
  plotMid: number;
  /** The radius of the active ring; 0 for none. */
  ring?: number;
  children: React.ReactNode;
}) {
  const active = hover?.key === id;
  const show = () => onHover({ key: id, x, y, flip: x > plotMid, readout });
  return (
    <g
      tabIndex={0}
      role="img"
      aria-label={label}
      className="cursor-default outline-none"
      onPointerEnter={show}
      onPointerLeave={() => onLeave(id)}
      onFocus={show}
      onBlur={() => onLeave(id)}
    >
      {hit ? (
        <rect x={hit.x} y={hit.y} width={hit.width} height={hit.height} fill="transparent" />
      ) : (
        <circle cx={x} cy={y} r={12} fill="transparent" />
      )}
      {children}
      {active && ring > 0 && (
        <circle cx={x} cy={y} r={ring} fill="none" strokeWidth={1.5} className="stroke-foreground" />
      )}
    </g>
  );
}

/** A filled point: a dot, a square or a diamond, with the surface ring. */
export function Point({
  shape,
  x,
  y,
  color,
  size = 4.5,
}: {
  shape: "dot" | "square" | "diamond" | "hollow";
  x: number;
  y: number;
  color: string;
  size?: number;
}) {
  if (shape === "square") {
    return <rect x={x - size} y={y - size} width={size * 2} height={size * 2} rx={1.5} fill={color} style={RING} />;
  }
  if (shape === "diamond") {
    const d = size * 1.45;
    return <path d={`M${x} ${y - d} L${x + d} ${y} L${x} ${y + d} L${x - d} ${y} Z`} fill={color} style={RING} />;
  }
  if (shape === "hollow") {
    return <circle cx={x} cy={y} r={size - 0.5} fill="hsl(var(--card))" stroke={color} strokeWidth={2} />;
  }
  return <circle cx={x} cy={y} r={size} fill={color} style={RING} />;
}

/** A P10–P90 whisker: a 2 px stroke with short caps. */
export function Whisker({ x, yLow, yHigh, color, cap = 4 }: { x: number; yLow: number; yHigh: number; color: string; cap?: number }) {
  return (
    <g stroke={color} strokeWidth={2} strokeLinecap="round">
      <line x1={x} y1={yLow} x2={x} y2={yHigh} />
      <line x1={x - cap} y1={yLow} x2={x + cap} y2={yLow} />
      <line x1={x - cap} y1={yHigh} x2={x + cap} y2={yHigh} />
    </g>
  );
}
