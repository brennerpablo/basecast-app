"use client";

import { ArrowDown, ArrowUp } from "lucide-react";
import * as React from "react";

import { cellAlign } from "./cell-text";
import {
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  Z_CORNER,
  Z_HEADER,
} from "./constants";
import { useGridContext } from "./grid-context";
import { GridFilterPopover } from "./grid-filter-popover";
import { useGridSelection } from "./selection-store";
import type { GridColumn } from "./types";

export function GridHeader() {
  const {
    columns,
    colOffsets,
    pinnedColumns,
    pinnedWidth,
    frozenCount,
    frozenWidth,
    strings,
  } = useGridContext();
  return (
    <div
      className="sticky top-0 flex border-b bg-background"
      style={{
        zIndex: Z_HEADER,
        height: HEADER_HEIGHT,
        width: GUTTER_WIDTH + colOffsets[columns.length] + pinnedWidth,
      }}
    >
      {/* Covers the sub-pixel seam a sticky header leaves at its top edge on
          fractional scroll offsets (Chrome/HiDPI), through which the row
          border behind it would otherwise peek as a flickering line. The
          strip sits ABOVE the header and is clipped by the scroll container,
          so it only ever paints over the seam. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-1 h-1 bg-background"
      />
      <div
        data-grid-corner
        title={strings.selectAllCorner}
        className="sticky left-0 shrink-0 cursor-pointer border-r bg-muted"
        style={{ zIndex: Z_CORNER, width: GUTTER_WIDTH }}
      />
      {frozenCount > 0 && (
        // Frozen-left header lane. Its FLOW width is exactly the width of the
        // columns inside it, so `colOffsets` — and therefore every index
        // calculation in the grid — is unaffected by the freeze. Ordinary
        // `HeaderCell`s: a frozen column still sorts, filters and resizes.
        <div
          className="sticky flex shrink-0 bg-background shadow-[2px_0_0_0_var(--color-border)]"
          style={{ zIndex: 1, left: GUTTER_WIDTH, width: frozenWidth }}
        >
          {columns.slice(0, frozenCount).map((col, i) => (
            <HeaderCell key={col.id} col={col} index={i} />
          ))}
        </div>
      )}
      {columns.slice(frozenCount).map((col, i) => (
        <HeaderCell key={col.id} col={col} index={frozenCount + i} />
      ))}
      {pinnedColumns.length > 0 && (
        // Frozen-right header lane — mirror of the sticky-left corner.
        <div
          className="sticky right-0 flex shrink-0 border-l bg-background"
          style={{ zIndex: Z_CORNER, width: pinnedWidth }}
        >
          {pinnedColumns.map((col) => (
            <div
              key={col.id}
              className="flex shrink-0 items-center border-r bg-background px-2"
              style={{ width: col.width }}
            >
              <span
                className="min-w-0 flex-1 truncate text-xs font-medium"
                title={col.title}
              >
                {col.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const HeaderCell = React.memo(function HeaderCell({
  col,
  index,
}: {
  col: GridColumn<never>;
  index: number;
}) {
  const { store, sorting, startResize, autoSizeColumn, strings } =
    useGridContext();
  const isSelected = useGridSelection(store, () => {
    const rect = store.getRect();
    return !!rect && index >= rect.c0 && index <= rect.c1;
  });

  const sorted = sorting?.id === col.id ? (sorting.desc ? "desc" : "asc") : null;

  return (
    <div
      data-grid-header-col={index}
      className="group relative flex shrink-0 cursor-pointer items-center gap-1 border-r bg-background px-2 select-none"
      style={{ width: col.width }}
    >
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 bg-basecast-brand/10" />
      )}
      <span
        className="min-w-0 flex-1 truncate text-xs font-medium"
        style={{ textAlign: cellAlign(col) }}
        title={col.title}
      >
        {col.title}
      </span>
      {sorted === "asc" && (
        <ArrowUp className="size-3 shrink-0 text-basecast-brand" />
      )}
      {sorted === "desc" && (
        <ArrowDown className="size-3 shrink-0 text-basecast-brand" />
      )}
      <GridFilterPopover col={col} index={index} />
      <div
        data-grid-resize={index}
        aria-hidden
        title={strings.resizeHint}
        className="absolute top-0 -right-0.75 z-10 h-full w-1.5 cursor-col-resize hover:bg-basecast-brand/50"
        onMouseDown={(e) => {
          // The delegated grid mousedown ignores [data-grid-resize]; this
          // handler owns the drag from the first pixel.
          e.preventDefault();
          e.stopPropagation();
          startResize(col.id, e.clientX, col.width);
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          autoSizeColumn(col.id);
        }}
      />
    </div>
  );
});
