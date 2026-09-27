"use client";

import type * as React from "react";

/** The hover card every forecast chart shares: a title and label/value rows with their swatches. */
export function ChartTooltipCard({
  title,
  rows,
}: {
  title: React.ReactNode;
  rows: { label: string; value: string; color?: string; dashed?: boolean }[];
}) {
  return (
    <div className="min-w-48 rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium text-foreground">{title}</p>
      <ul className="space-y-0.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2">
            {row.color && (
              <span
                className="inline-block h-0.5 w-3 shrink-0"
                style={row.dashed ? { borderTop: `2px dashed ${row.color}` } : { background: row.color, height: 8, borderRadius: 2 }}
              />
            )}
            <span className="text-muted-foreground">{row.label}</span>
            <span className="ml-auto pl-3 font-medium text-foreground tabular-nums">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
