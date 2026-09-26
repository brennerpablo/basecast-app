"use client";

import type { VirtualItem } from "@tanstack/react-virtual";
import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

import { cellAlign, cellText, matchRange } from "./cell-text";
import { GUTTER_WIDTH, HEADER_HEIGHT, Z_FROZEN, Z_GUTTER } from "./constants";
import { useGridContext } from "./grid-context";
import { intFormat } from "./i18n";
import { useGridSelection } from "./selection-store";
import type { GridCellAction, GridColumn } from "./types";

/**
 * Virtualized rows. The perf contract: `GridCell` is a pure memoized leaf
 * with no hooks — nothing about selection/hover reaches it, so a drag-select
 * never re-renders the body. Rows re-render only when their block loads.
 */

export function GridBody({
  items,
  getRow,
}: {
  items: VirtualItem[];
  getRow: (index: number) => unknown;
}) {
  const {
    columns,
    colOffsets,
    pinnedColumns,
    pinnedWidth,
    rowHeight,
    frozenCount,
    frozenWidth,
    findNeedle,
  } = useGridContext();
  const width = GUTTER_WIDTH + colOffsets[columns.length] + pinnedWidth;
  return (
    <>
      {items.map((vi) => (
        <GridRow
          key={vi.index}
          index={vi.index}
          // virtualItem.start includes the virtualizer's scrollMargin (the
          // sticky header); rows are positioned inside the canvas below it.
          top={vi.start - HEADER_HEIGHT}
          height={rowHeight}
          row={getRow(vi.index)}
          columns={columns}
          pinnedColumns={pinnedColumns}
          pinnedWidth={pinnedWidth}
          width={width}
          frozenCount={frozenCount}
          frozenWidth={frozenWidth}
          highlight={findNeedle}
        />
      ))}
    </>
  );
}

type GridRowProps = {
  index: number;
  top: number;
  height: number;
  row: unknown;
  columns: GridColumn<never>[];
  pinnedColumns: GridColumn<never>[];
  pinnedWidth: number;
  width: number;
  frozenCount: number;
  frozenWidth: number;
  /** Folded Find needle, "" when the find bar is closed. */
  highlight: string;
};

const GridRow = React.memo(function GridRow({
  index,
  top,
  height,
  row,
  columns,
  pinnedColumns,
  pinnedWidth,
  width,
  frozenCount,
  frozenWidth,
  highlight,
}: GridRowProps) {
  const record = row as Record<string, unknown> | undefined;
  const zebra = index % 2 === 1;

  const renderCell = (col: GridColumn<never>, c: number) => {
    const text = cellText(col, record as never);
    if (col.action) {
      return (
        <GridActionCell
          key={col.id}
          action={col.action as GridCellAction<never>}
          row={record}
          text={text}
          highlight={highlight}
          width={col.width}
          align={cellAlign(col)}
          mono={!!col.mono}
          loaded={!!record}
          r={index}
          c={c}
        />
      );
    }
    return (
      <GridCell
        key={col.id}
        text={text}
        highlight={highlight}
        width={col.width}
        align={cellAlign(col)}
        mono={!!col.mono}
        loaded={!!record}
        r={index}
        c={c}
      />
    );
  };

  return (
    <div
      className={cn(
        "group absolute left-0 flex hover:bg-accent/40",
        zebra && "bg-muted/30",
      )}
      style={{ top, height, width }}
    >
      <GutterCell index={index} />
      {frozenCount > 0 && (
        // Frozen-left lane. The cells inside are ORDINARY grid cells — they
        // keep their `data-grid-cell` markers and their visible indices, so
        // selection, copy, keyboard and export never learn that a freeze
        // exists. Only the painting changes: the lane is sticky and opaque, so
        // the scrolling columns pass behind it.
        <div
          className="sticky flex shrink-0 bg-background shadow-[2px_0_0_0_var(--color-border)]"
          style={{ zIndex: Z_FROZEN, left: GUTTER_WIDTH, width: frozenWidth }}
        >
          <LaneBackdrop zebra={zebra} />
          {columns.slice(0, frozenCount).map((col, i) => renderCell(col, i))}
        </div>
      )}
      {columns
        .slice(frozenCount)
        .map((col, i) => renderCell(col, frozenCount + i))}
      {pinnedColumns.length > 0 && (
        // Frozen-right lane — mirror of the sticky-left gutter. Display-only:
        // no data-grid-cell markers, so the mouse layer never selects it.
        <div
          className="sticky right-0 flex shrink-0 border-l bg-background"
          style={{ zIndex: Z_GUTTER, width: pinnedWidth }}
        >
          {pinnedColumns.map((col) => (
            <GridPinnedCell
              key={col.id}
              col={col}
              row={record}
              loaded={!!record}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/**
 * The row's zebra stripe and hover tint, repainted INSIDE the frozen lane.
 *
 * The lane has to be opaque or the columns scrolling under it show through,
 * and an opaque lane hides the two backgrounds the row itself paints. They
 * come back as negative-z layers: inside the lane's stacking context those
 * paint above its own background and below its cells, which is exactly where
 * the row's own stripes sit.
 */
function LaneBackdrop({ zebra }: { zebra: boolean }) {
  return (
    <>
      {zebra && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-muted/30"
        />
      )}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-accent/40 group-hover:block"
      />
    </>
  );
}

const GutterCell = React.memo(function GutterCell({ index }: { index: number }) {
  const { store, language } = useGridContext();
  // store.getRect() is cached per snapshot — one rect allocation per store
  // emit for all ~70 gutter/header subscribers, not one per subscriber.
  const isSelected = useGridSelection(store, () => {
    const rect = store.getRect();
    return !!rect && index >= rect.r0 && index <= rect.r1;
  });
  return (
    <div
      data-grid-gutter={index}
      className="sticky left-0 flex shrink-0 cursor-pointer items-center justify-end border-r border-b bg-muted pr-2 select-none"
      style={{ zIndex: Z_GUTTER, width: GUTTER_WIDTH }}
    >
      {isSelected && (
        <div className="pointer-events-none absolute inset-0 bg-basecast-brand/15" />
      )}
      <span
        className={cn(
          "relative text-[11px] tabular-nums",
          isSelected ? "font-medium text-foreground" : "text-muted-foreground",
        )}
      >
        {intFormat(language).format(index + 1)}
      </span>
    </div>
  );
});

/** Cell chrome shared by every data cell: borders, padding, alignment, font. */
function cellClass(align: "left" | "right", mono: boolean): string {
  return cn(
    "flex shrink-0 items-center overflow-hidden border-r border-b px-2 text-xs whitespace-nowrap",
    align === "right" ? "justify-end tabular-nums" : "justify-start",
    mono && "font-mono",
  );
}

const Pulse = ({ className }: { className: string }) => (
  <span className={cn("animate-pulse rounded-sm bg-muted", className)} />
);

type GridCellProps = {
  text: string;
  /** Folded Find needle; "" leaves the text alone. */
  highlight: string;
  width: number;
  align: "left" | "right";
  mono: boolean;
  loaded: boolean;
  r: number;
  c: number;
};

const GridCell = React.memo(function GridCell({
  text,
  highlight,
  width,
  align,
  mono,
  loaded,
  r,
  c,
}: GridCellProps) {
  return (
    <div
      data-grid-cell
      data-r={r}
      data-c={c}
      className={cellClass(align, mono)}
      style={{ width }}
    >
      {loaded ? (
        <CellText text={text} highlight={highlight} />
      ) : (
        <Pulse className="h-3 w-3/4" />
      )}
    </div>
  );
});

/** Cell text, with the first Find hit marked. */
function CellText({ text, highlight }: { text: string; highlight: string }) {
  const range = highlight ? matchRange(text, highlight) : null;
  if (!range) return <span className="truncate">{text}</span>;
  return (
    <span className="truncate">
      {text.slice(0, range[0])}
      <mark className="rounded-[2px] bg-yellow-300 text-inherit dark:bg-yellow-500/60">
        {text.slice(range[0], range[1])}
      </mark>
      {text.slice(range[1])}
    </span>
  );
}

const ICON_CLS =
  "inline-flex items-center text-muted-foreground hover:text-foreground";
const TEXT_LINK_CLS =
  "min-w-0 truncate font-medium text-basecast-brand-700 hover:underline";

/** A scheme ("https:", "mailto:") or protocol-relative URL: outside the app. */
function isExternalHref(href: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(href) || href.startsWith("//");
}

/**
 * The link/button inside an action cell, shared by the in-grid action cell and
 * the frozen-right pinned cell. Carries `data-grid-cell-action` so the mouse
 * layer skips it — a click fires the link/handler, never a selection.
 *
 * Navigation is a real anchor, never `router.push`: an app path is a Next
 * `<Link>` in the same tab (the tab strip records it, and the grid's
 * right-click menu offers "Open in new tab"); an absolute URL, or `newTab`,
 * is an `<a target="_blank">` and keeps the browser's own menu.
 */
function ActionContent({
  action,
  row,
  text,
  highlight,
}: {
  action: GridCellAction<never>;
  row: Record<string, unknown>;
  /** The cell's display text — the link's label when there is no icon. */
  text: string;
  highlight: string;
}) {
  if (action.render) {
    return (
      <span data-grid-cell-action className="inline-flex min-w-0 items-center">
        {action.render(row as never)}
      </span>
    );
  }
  const Icon = action.icon;
  const href = action.href?.(row as never);
  const label =
    (typeof action.label === "function"
      ? action.label(row as never)
      : action.label) || text;
  const content = Icon ? (
    <Icon className="size-4" />
  ) : (
    <CellText text={text} highlight={highlight} />
  );
  const className = Icon ? ICON_CLS : TEXT_LINK_CLS;

  if (href) {
    if (action.newTab || isExternalHref(href)) {
      return (
        <a
          data-grid-cell-action
          href={href}
          target="_blank"
          rel="noreferrer"
          title={label}
          aria-label={Icon ? label : undefined}
          className={className}
        >
          {content}
        </a>
      );
    }
    return (
      <Link
        data-grid-cell-action
        href={href}
        prefetch={action.prefetch ?? false}
        title={label}
        aria-label={Icon ? label : undefined}
        className={className}
      >
        {content}
      </Link>
    );
  }
  if (action.onClick) {
    return (
      <button
        type="button"
        data-grid-cell-action
        title={label}
        aria-label={Icon ? label : undefined}
        className={cn(className, !Icon && "text-left")}
        onClick={() => action.onClick?.(row as never)}
      >
        {content}
      </button>
    );
  }
  // Nothing to go to for this row: a text cell stays readable, an icon cell
  // stays empty.
  return Icon ? null : <CellText text={text} highlight={highlight} />;
}

type GridActionCellProps = {
  action: GridCellAction<never>;
  row: Record<string, unknown> | undefined;
  text: string;
  highlight: string;
  width: number;
  align: "left" | "right";
  mono: boolean;
  loaded: boolean;
  r: number;
  c: number;
};

/**
 * Link/action cell in the scrollable grid. Still a real `[data-grid-cell]`
 * so the column stays selectable/copyable. (When a column is `pinned`, it goes
 * to the frozen lane via `GridPinnedCell` instead.)
 */
const GridActionCell = React.memo(function GridActionCell({
  action,
  row,
  text,
  highlight,
  width,
  align,
  mono,
  loaded,
  r,
  c,
}: GridActionCellProps) {
  const iconOnly = !!action.icon;
  return (
    <div
      data-grid-cell
      data-r={r}
      data-c={c}
      className={cn(cellClass(align, mono), iconOnly && "justify-center")}
      style={{ width }}
    >
      {loaded && row ? (
        <ActionContent
          action={action}
          row={row}
          text={text}
          highlight={highlight}
        />
      ) : (
        <Pulse className={iconOnly ? "size-3.5" : "h-3 w-3/4"} />
      )}
    </div>
  );
});

/**
 * One cell in the frozen-right pinned lane. Display-only (no `data-grid-cell`),
 * opaque background so scrolled content passes cleanly behind it. Renders the
 * column's link/action, or plain text for a non-action pinned column.
 */
const GridPinnedCell = React.memo(function GridPinnedCell({
  col,
  row,
  loaded,
}: {
  col: GridColumn<never>;
  row: Record<string, unknown> | undefined;
  loaded: boolean;
}) {
  const text = cellText(col, row as never);
  const iconOnly = !!col.action?.icon;
  return (
    <div
      className={cn(
        cellClass(cellAlign(col), !!col.mono),
        "bg-background",
        iconOnly && "justify-center",
      )}
      style={{ width: col.width }}
    >
      {!loaded || !row ? (
        <Pulse className={iconOnly ? "size-3.5" : "h-3 w-3/4"} />
      ) : col.action ? (
        <ActionContent action={col.action} row={row} text={text} highlight="" />
      ) : (
        <span className="truncate">{text}</span>
      )}
    </div>
  );
});
