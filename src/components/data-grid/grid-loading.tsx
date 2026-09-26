"use client";

import { SearchX } from "lucide-react";
import * as React from "react";

import { GUTTER_WIDTH, HEADER_HEIGHT, Z_GUTTER } from "./constants";
import { useGridContext } from "./grid-context";

/**
 * What lives in the sheet area while `rowCount === 0`:
 * - fetching → a ghost sheet: skeleton rows matching the real gutter/column
 *   geometry (bar widths are a pure function of row/col — deterministic,
 *   render-safe);
 * - not fetching → an empty-state message.
 * The status-bar spinner stays as the "official" loading signal.
 */

/**
 * Enough rows to overflow any realistic viewport. The ghost fills the sheet
 * via `absolute inset` + `overflow-hidden` (below), so the surplus is simply
 * clipped — no measuring, no resize jump.
 */
const GHOST_ROWS = 40;

/** Deterministic pseudo-random bar width, % of the cell. */
const ghostWidth = (r: number, c: number) => 40 + ((r * 7 + c * 13) % 45);

/**
 * Empty-state message, centered in the visible sheet. Rendered as an overlay
 * on the CARD (not the h-scrollable canvas, where centering would land
 * off-screen); `top` clears the sticky header so it centers the row area.
 */
export function GridEmptyState() {
  const { strings } = useGridContext();
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-2 text-muted-foreground"
      style={{ top: HEADER_HEIGHT }}
    >
      <SearchX className="size-8" />
      <p className="text-sm font-medium">{strings.emptyTitle}</p>
      <p className="text-xs">{strings.emptyHint}</p>
    </div>
  );
}

export function GridLoadingState() {
  const { columns, rowHeight } = useGridContext();

  return (
    // Fill the sheet below the header and clip the surplus rows, so the ghost
    // always covers the visible area at any height with no measure/resize jump.
    // One soft pulse over the whole ghost — deliberately quieter than a
    // per-cell shimmer; the status-bar spinner is the loud signal.
    <div
      aria-hidden
      className="absolute inset-x-0 bottom-0 animate-pulse overflow-hidden"
      style={{ top: HEADER_HEIGHT }}
    >
      {Array.from({ length: GHOST_ROWS }, (_, r) => (
        <div key={r} className="flex" style={{ height: rowHeight }}>
          <div
            className="sticky left-0 shrink-0 border-r border-b bg-muted"
            style={{ zIndex: Z_GUTTER, width: GUTTER_WIDTH }}
          />
          {columns.map((col, c) => (
            <div
              key={col.id}
              className="flex shrink-0 items-center border-r border-b px-2"
              style={{ width: col.width }}
            >
              <span
                className="h-2.5 rounded-sm bg-muted/70"
                style={{ width: `${ghostWidth(r, c)}%` }}
              />
            </div>
          ))}
        </div>
      ))}
      {/* Fade the ghost out toward the bottom so it reads as "more coming",
          not as a hard-edged fake dataset. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-linear-to-t from-background from-30% via-background/70 to-transparent" />
    </div>
  );
}
