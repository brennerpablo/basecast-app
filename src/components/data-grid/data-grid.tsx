"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import * as React from "react";
import { toast } from "sonner";

import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { linkTarget } from "@/lib/tabs/link-target";
import { cn } from "@/lib/utils";

import { fontOf, measureAutoWidth } from "./autosize";
import { cellText } from "./cell-text";
import { type CopyResult, copySelection } from "./clipboard";
import {
  DENSITIES,
  type GridDensity,
  GUTTER_WIDTH,
  HEADER_HEIGHT,
  MAX_COL_WIDTH,
  MIN_COL_WIDTH,
  OVERSCAN,
  ROW_HEIGHT,
  Z_DROPLINE,
} from "./constants";
import { GridBody } from "./grid-body";
import { GridContext, type GridContextValue } from "./grid-context";
import { GridContextMenuContent } from "./grid-context-menu";
import { GridFindBar } from "./grid-find";
import { GridHeader } from "./grid-header";
import { GridEmptyState, GridLoadingState } from "./grid-loading";
import { type GridLanguage, intFormat, resolveGridStrings } from "./i18n";
import { scrollCellIntoView } from "./scroll-into-view";
import { SelectionOverlay } from "./selection-overlay";
import { GridSelectionStore } from "./selection-store";
import { GridStatusBar, type GridStatusSummary } from "./status-bar";
import { GridToolbar, type GridToolbarConfig } from "./toolbar";
import type {
  CellCoord,
  GridAggregate,
  GridColumn,
  GridColumnState,
  GridFilterOption,
  GridFilterState,
  GridSortState,
} from "./types";
import { useGridHistory } from "./use-grid-history";
import { useGridKeyboard } from "./use-grid-keyboard";
import { useGridMouse } from "./use-grid-mouse";

/**
 * How far past the viewport double-click autosize looks for loaded rows.
 * Wide enough to cover the resident blocks (viewport ±1 block), and bounded
 * so the scan can't walk a 100k-row window on a gesture.
 */
const AUTOSIZE_SCAN_ROWS = 1_500;

export type DataGridProps<TData> = {
  /** Base column definitions (full set; display is driven by columnState). */
  columns: GridColumn<TData>[];
  /** User-adjustable layout: order, hidden, width overrides. Controlled. */
  columnState: GridColumnState;
  onColumnStateChange: (s: GridColumnState) => void;
  /** Virtualized row count — already capped to the browsable window. */
  rowCount: number;
  /** Uncapped filtered total, for the status bar. */
  totalCount: number;
  /** Sparse accessor — `undefined` while the row's block loads. */
  getRow: (index: number) => TData | undefined;
  /** Fired with the visible index range; drives block fetching. */
  onViewportChange: (startRow: number, endRow: number) => void;
  sorting: GridSortState;
  onSortingChange: (s: GridSortState) => void;
  filters: GridFilterState;
  onFiltersChange: (f: GridFilterState) => void;
  /** Distinct-value lists for checkbox filters, keyed by `optionsKey`. */
  filterOptions?: Record<string, GridFilterOption[]>;
  isFetching?: boolean;
  /** Previous rows shown as placeholder while a new sort/filter loads —
   * dims the body under a subtle veil instead of blanking the sheet. */
  isRefreshing?: boolean;
  summary?: GridStatusSummary | null;
  /**
   * Exact per-column aggregates for a row range of the CURRENT sort+filter,
   * asked of the server when the selection reaches rows the grid hasn't
   * loaded. Omit and the status bar keeps labeling those numbers "partial" —
   * it never silently reports a partial sum as a total.
   */
  selectionStats?: (req: {
    r0: number;
    r1: number;
    columnIds: string[];
  }) => Promise<Record<string, GridAggregate>>;
  /** Top toolbar: export, fullscreen, saved views, column picker. Omit to hide it. */
  toolbar?: GridToolbarConfig<TData>;
  /**
   * Changes when sort/filters change: clears the selection and scrolls back
   * to the top WITHOUT remounting (a remount would drop the scroll element).
   */
  resetToken?: string;
  /** UI language for the chrome (toolbar, filters, status bar, toasts). */
  language?: GridLanguage;
  className?: string;
};

export function DataGrid<TData>({
  columns,
  columnState,
  onColumnStateChange: onColumnStateChangeProp,
  rowCount,
  totalCount,
  getRow,
  onViewportChange,
  sorting,
  onSortingChange: onSortingChangeProp,
  filters,
  onFiltersChange: onFiltersChangeProp,
  filterOptions,
  isFetching,
  isRefreshing,
  summary,
  selectionStats,
  toolbar,
  resetToken,
  language = "en",
  className,
}: DataGridProps<TData>) {
  const strings = React.useMemo(() => resolveGridStrings(language), [language]);
  const intFmt = intFormat(language);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  // One store per grid mount, created once (a lazy state initializer, so it
  // is never rebuilt and never read from a ref during render).
  const [store] = React.useState(() => new GridSelectionStore());

  // The three view setters go through the history BEFORE reaching anything
  // else — the column popover, the toolbar and the grid's own gestures
  // (resize, move, freeze) all use the wrapped ones from here down, and that
  // is what turns every click into an undoable step. See `use-grid-history.ts`.
  const {
    onFiltersChange,
    onSortingChange,
    onColumnStateChange,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useGridHistory({
    filters,
    sorting,
    columnState,
    onFiltersChange: onFiltersChangeProp,
    onSortingChange: onSortingChangeProp,
    onColumnStateChange: onColumnStateChangeProp,
  });

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const toggleFullscreen = React.useCallback(
    () => setIsFullscreen((v) => !v),
    [],
  );

  // Row density is a per-person reading preference, not part of the shared
  // view: it rides localStorage next to the saved views rather than inside
  // them, so applying a colleague's saved filter doesn't also resize their
  // rows onto your screen. Grids without a `savedViews` storage key simply
  // don't persist it.
  const densityKey = toolbar?.savedViews?.storageKey
    ? `${toolbar.savedViews.storageKey}:density`
    : null;
  const [density, setDensity] = React.useState<GridDensity | null>(null);
  React.useEffect(() => {
    if (!densityKey) return;
    try {
      const saved = localStorage.getItem(densityKey);
      if (saved && DENSITIES.some((d) => d.id === saved)) {
        setDensity(saved as GridDensity);
      }
    } catch {
      // Private mode / blocked storage: the default density is fine.
    }
  }, [densityKey]);
  const changeDensity = React.useCallback(
    (next: GridDensity) => {
      setDensity(next);
      if (!densityKey) return;
      try {
        localStorage.setItem(densityKey, next);
      } catch {
        // Same as above — persisting is a nicety, not a requirement.
      }
    },
    [densityKey],
  );
  const rowHeight =
    DENSITIES.find((d) => d.id === density)?.rowHeight ?? ROW_HEIGHT;

  /**
   * How many right-clicks there have been. It is the `key` of the menu
   * content, and it exists because of ONE Radix detail: `ContextMenuTrigger`
   * stores the click point in a REF and calls `onOpenChange(true)`. With the
   * menu already open that is a no-op — nothing re-renders, Popper never
   * re-measures the virtual anchor, and the menu stays where it was while the
   * ref already points at the new cell. The symptom was exactly that:
   * right-clicking a second cell reopened the menu on top of the first, and
   * only a left click in between (which really closes it) untangled things.
   *
   * Changing the `key` remounts the content, and remounting is what makes
   * Popper measure again. This handler is React's and so is Radix's, so both
   * land in the SAME batch: by the time the remount measures, the ref has been
   * updated. (It lives on the `div` and not in the native `use-grid-mouse`
   * listener on purpose — the native one fires earlier, and the batch would
   * stop being guaranteed.)
   */
  const [contextMenuEpoch, setContextMenuEpoch] = React.useState(0);
  /** The app path under the last right-click, when it landed on a link cell. */
  const [contextMenuLink, setContextMenuLink] = React.useState<string | null>(
    null,
  );

  // Find (Ctrl/Cmd+F). The needle is folded by the find bar and rides the
  // context down to the cells, which mark their first hit.
  const [findOpen, setFindOpen] = React.useState(false);
  const [findNeedle, setFindNeedle] = React.useState("");
  const openFind = React.useCallback(() => setFindOpen(true), []);
  const closeFind = React.useCallback(() => {
    setFindOpen(false);
    scrollRef.current?.focus({ preventScroll: true });
  }, []);

  // Live width overrides while a resize drag is in flight — grid-local so
  // the screen doesn't re-render per pointer frame; committed to
  // columnState on release.
  const [dragWidths, setDragWidths] = React.useState<Record<
    string,
    number
  > | null>(null);

  // THE load-bearing derivation: everything below (offsets, selection
  // indices, clipboard, status bar, keyboard, export) operates on contiguous
  // VISIBLE indices. Hidden columns must never leak into index math.
  // Pinned-right columns are pulled into a separate sticky lane and are NOT
  // part of the selectable data grid — so the index math only ever sees the
  // unpinned (scrollable) columns.
  const { visibleColumns, pinnedColumns } = React.useMemo(() => {
    const byId = new Map(columns.map((c) => [c.id, c]));
    const hidden = new Set(columnState.hidden);
    const data: GridColumn<TData>[] = [];
    const pinned: GridColumn<TData>[] = [];
    for (const id of columnState.order) {
      const col = byId.get(id);
      if (!col || hidden.has(id)) continue;
      const width = dragWidths?.[id] ?? columnState.widths[id];
      const resolved =
        width != null && width !== col.width ? { ...col, width } : col;
      (resolved.pinned === "right" ? pinned : data).push(resolved);
    }
    return { visibleColumns: data, pinnedColumns: pinned };
  }, [columns, columnState, dragWidths]);

  const pinnedWidth = React.useMemo(
    () => pinnedColumns.reduce((sum, c) => sum + c.width, 0),
    [pinnedColumns],
  );

  const colOffsets = React.useMemo(() => {
    const offsets = [0];
    for (const col of visibleColumns)
      offsets.push(offsets[offsets.length - 1] + col.width);
    return offsets;
  }, [visibleColumns]);

  // Freezing is pure painting: the frozen columns keep their visible indices
  // and their place in `colOffsets`, so nothing downstream changes. Clamped
  // here as well as in `sanitizeColumnState` because hiding a column can drop
  // the visible count under a previously-valid freeze.
  const frozenCount = Math.min(
    Math.max(0, columnState.frozen ?? 0),
    Math.max(0, visibleColumns.length - 1),
  );
  const frozenWidth = colOffsets[frozenCount] ?? 0;

  const setFrozen = React.useCallback(
    (count: number) => {
      const max = Math.max(0, visibleColumns.length - 1);
      onColumnStateChange({
        ...columnState,
        frozen: Math.max(0, Math.min(count, max)),
      });
    },
    [visibleColumns.length, columnState, onColumnStateChange],
  );

  // Order/visibility changes re-map what each visible index MEANS — clear
  // the selection (unless a header move just replaced it deliberately).
  // Width changes don't alter indices and must NOT clear (hence the id-join
  // key, not visibleColumns identity).
  const visibleIdsKey = visibleColumns.map((c) => c.id).join(",");
  const justMovedRef = React.useRef(false);
  const prevIdsRef = React.useRef(visibleIdsKey);
  React.useEffect(() => {
    store.setDimensions(rowCount, visibleColumns.length);
    if (prevIdsRef.current !== visibleIdsKey) {
      prevIdsRef.current = visibleIdsKey;
      if (justMovedRef.current) justMovedRef.current = false;
      else store.clear();
    }
  }, [store, rowCount, visibleIdsKey, visibleColumns.length]);

  const startResize = React.useCallback(
    (colId: string, startX: number, startWidth: number) => {
      let rafId = 0;
      let lastX = startX;
      let lastWidth = startWidth;
      const onMove = (e: MouseEvent) => {
        lastX = e.clientX;
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          lastWidth = Math.max(
            MIN_COL_WIDTH,
            Math.min(MAX_COL_WIDTH, startWidth + (lastX - startX)),
          );
          setDragWidths({ [colId]: lastWidth });
        });
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (rafId) cancelAnimationFrame(rafId);
        document.body.classList.remove("cursor-col-resize");
        if (lastWidth !== startWidth) {
          onColumnStateChange({
            ...columnState,
            widths: { ...columnState.widths, [colId]: lastWidth },
          });
        }
        setDragWidths(null);
      };
      document.body.classList.add("cursor-col-resize");
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [columnState, onColumnStateChange],
  );

  // `getRow` and the viewport range change identity on every block load. They
  // are read through refs so the callbacks that need them (autosize) stay
  // stable — a churning callback would churn the grid context and re-render
  // every header and gutter cell each time a block lands.
  const getRowRef = React.useRef(getRow);
  React.useEffect(() => {
    getRowRef.current = getRow;
  }, [getRow]);
  const viewportRef = React.useRef({ first: 0, last: 0 });

  const autoSizeColumn = React.useCallback(
    (colId: string) => {
      const col = visibleColumns.find((c) => c.id === colId);
      const el = scrollRef.current;
      if (!col || !el) return;
      // Fonts come from live nodes — see autosize.ts on why they are not
      // hardcoded.
      const cellEl = el.querySelector("[data-grid-cell] span");
      const headerEl = el.querySelector("[data-grid-header-col] span");
      const cellFont = cellEl ? fontOf(cellEl) : "12px sans-serif";
      const headerFont = headerEl ? fontOf(headerEl) : cellFont;

      const { first, last } = viewportRef.current;
      const from = Math.max(0, first - AUTOSIZE_SCAN_ROWS);
      const to = Math.min(rowCount - 1, last + AUTOSIZE_SCAN_ROWS);
      const texts: string[] = [];
      for (let r = from; r <= to; r++) {
        const row = getRowRef.current(r);
        if (row) texts.push(cellText(col, row));
      }

      const width = measureAutoWidth({
        title: col.title,
        texts,
        cellFont,
        headerFont,
      });
      if (width == null || width === col.width) return;
      onColumnStateChange({
        ...columnState,
        widths: { ...columnState.widths, [colId]: width },
      });
    },
    [visibleColumns, rowCount, columnState, onColumnStateChange],
  );

  // Sheets-style header move: the mouse hook reports the live drop boundary
  // and the commit in VISIBLE indices; we translate to ids on the full order.
  const [colDropTarget, setColDropTarget] = React.useState<number | null>(null);

  const handleColMove = React.useCallback(
    (from: number, to: number) => {
      // Dropping on either edge of the moved column itself is a no-op.
      if (to === from || to === from + 1) return;
      const visIds = visibleColumns.map((c) => c.id);
      const movedId = visIds[from];
      if (!movedId) return;
      const order = [...columnState.order];
      order.splice(order.indexOf(movedId), 1);
      if (to >= visIds.length) {
        const lastId = visIds[visIds.length - 1];
        order.splice(order.indexOf(lastId) + 1, 0, movedId);
      } else {
        order.splice(order.indexOf(visIds[to]), 0, movedId);
      }
      justMovedRef.current = true;
      onColumnStateChange({ ...columnState, order });
      // Keep the moved column selected at its new position (Sheets does).
      store.selectColumn(to > from ? to - 1 : to, false);
      store.endDrag();
    },
    [visibleColumns, columnState, onColumnStateChange, store],
  );

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: OVERSCAN,
    // The sticky header sits INSIDE the scroll container above the rows
    // canvas; without this, scrollToIndex/range math is 36px shallow and
    // keyboard navigation leaves the active row clipped under the fold.
    scrollMargin: HEADER_HEIGHT,
  });
  const items = virtualizer.getVirtualItems();

  // Row height is a virtualizer option, not reactive state — re-measure so a
  // density change repositions the rows instead of leaving them at the height
  // measured on mount.
  React.useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, rowHeight]);

  // Sort/filter change: clear selection, scroll to top, keep the mount.
  // Declared BEFORE the viewport effect so the scroll reset lands first on a
  // reset commit and the viewport effect doesn't report the stale position.
  const prevResetRef = React.useRef(resetToken);
  React.useEffect(() => {
    if (prevResetRef.current === resetToken) return;
    prevResetRef.current = resetToken;
    store.clear();
    virtualizer.scrollToOffset(0);
    if (scrollRef.current) scrollRef.current.scrollLeft = 0;
  }, [resetToken, store, virtualizer]);

  const firstIndex = items[0]?.index ?? 0;
  const lastIndex = items[items.length - 1]?.index ?? 0;
  React.useEffect(() => {
    viewportRef.current = { first: firstIndex, last: lastIndex };
    if (rowCount > 0) onViewportChange(firstIndex, lastIndex);
  }, [onViewportChange, firstIndex, lastIndex, rowCount]);

  // Fullscreen Escape exit. The grid's own keydown handler stops propagation
  // when it clears a selection, so an Escape reaching here means no selection
  // consumed it. Window-level so it also works when focus is on the toolbar.
  React.useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !store.getRect()) setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen, store]);

  useGridMouse({
    scrollRef,
    store,
    colOffsets,
    rowCount,
    colCount: visibleColumns.length,
    rowHeight,
    frozenWidth,
    onColMoveTarget: setColDropTarget,
    onColMove: handleColMove,
  });

  const handleCopy = React.useCallback(() => {
    const rect = store.getRect();
    if (!rect) return;
    const onCopied = (res: CopyResult) => {
      if (!res.cells) {
        toast.warning(strings.nothingCopied);
        return;
      }
      store.flashCopy(rect);
      const totalRows = rect.r1 - rect.r0 + 1;
      if (res.skippedRows || res.truncatedRows) {
        // Partial copies must be loud — pasting silently truncated data into
        // a sheet is worse than no copy at all.
        toast.warning(
          strings.copiedPartial(
            intFmt.format(res.rows),
            intFmt.format(totalRows),
            !!res.skippedRows,
            !!res.truncatedRows,
          ),
        );
      } else {
        toast.success(strings.cellsCopied(intFmt.format(res.cells)));
      }
    };
    // The browser can refuse the clipboard (no permission, document not
    // focused): say so instead of leaving the user to paste stale data.
    void copySelection({ rect, columns: visibleColumns, getRow }).then(
      onCopied,
      () => toast.error(strings.copyFailed),
    );
  }, [store, visibleColumns, getRow, strings, intFmt]);

  const onKeyDown = useGridKeyboard({
    scrollRef,
    store,
    virtualizer,
    colOffsets,
    rowCount,
    colCount: visibleColumns.length,
    rowHeight,
    frozenCount,
    frozenWidth,
    onCopy: handleCopy,
    onFind: openFind,
    onUndo: undo,
    onRedo: redo,
  });

  /** Select a cell and bring it into view — the find bar's jump. */
  const goToCell = React.useCallback(
    (coord: CellCoord) => {
      store.setActive(coord);
      scrollCellIntoView({
        el: scrollRef.current,
        virtualizer,
        colOffsets,
        frozenWidth,
        frozenCount,
        coord,
      });
    },
    [store, virtualizer, colOffsets, frozenWidth, frozenCount],
  );

  // getRow deliberately does NOT ride the context: its identity changes on
  // every block load, and gutter/header cells never read it. It goes as a
  // direct prop to the two consumers (body, status bar) instead.
  const ctx = React.useMemo<GridContextValue>(
    () => ({
      store,
      columns: visibleColumns as GridColumn<never>[],
      colOffsets,
      pinnedColumns: pinnedColumns as GridColumn<never>[],
      pinnedWidth,
      rowCount,
      rowHeight,
      sorting,
      onSortingChange,
      filters,
      onFiltersChange,
      filterOptions: filterOptions ?? {},
      startResize,
      autoSizeColumn,
      frozenCount,
      frozenWidth,
      setFrozen,
      findNeedle,
      strings,
      language,
    }),
    [
      store,
      visibleColumns,
      colOffsets,
      pinnedColumns,
      pinnedWidth,
      rowCount,
      rowHeight,
      sorting,
      onSortingChange,
      filters,
      onFiltersChange,
      filterOptions,
      startResize,
      autoSizeColumn,
      frozenCount,
      frozenWidth,
      setFrozen,
      findNeedle,
      strings,
      language,
    ],
  );

  const canvasWidth =
    GUTTER_WIDTH + colOffsets[visibleColumns.length] + pinnedWidth;

  return (
    <GridContext.Provider value={ctx}>
      {/* Outer column: the toolbar is a separate card, gapped from the sheet.
          Fullscreen (CSS-only — portaling would remount the scroll container
          and drop the virtualizer's scroll/selection) pads the cards off the
          viewport edges. */}
      <div
        className={cn(
          "flex min-h-0 flex-col gap-2",
          className,
          isFullscreen && "fixed inset-0 z-50 bg-background p-3",
        )}
      >
        {toolbar && (
          <GridToolbar
            config={toolbar}
            columns={[...visibleColumns, ...pinnedColumns]}
            allColumns={columns}
            columnState={columnState}
            onColumnStateChange={onColumnStateChange}
            filters={filters}
            onFiltersChange={onFiltersChange}
            sorting={sorting}
            onSortingChange={onSortingChange}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            density={density}
            onDensityChange={changeDensity}
            onFind={openFind}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />
        )}
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-background">
          {findOpen && (
            <GridFindBar
              columns={visibleColumns}
              rowCount={rowCount}
              getRow={getRow}
              onNeedleChange={setFindNeedle}
              onGo={goToCell}
              onClose={closeFind}
            />
          )}
          {rowCount === 0 && !isFetching && <GridEmptyState />}
          {/* Refresh veil companion: a small floating pill anchored to the
              CARD (not the 3000px-wide canvas, where centering would land
              off-screen). */}
          {isRefreshing && rowCount > 0 && (
            <div className="pointer-events-none absolute bottom-12 left-1/2 z-40 -translate-x-1/2">
              <span className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground shadow-sm">
                <span className="size-3 animate-spin rounded-full border-2 border-muted-foreground/40 border-t-transparent" />
                {strings.loading}
              </span>
            </div>
          )}
          {/* The context menu wraps ONLY the scroll container, so the toolbar
              and the status bar keep the browser's own menu. `asChild` keeps
              the same element in the DOM — Radix's trigger draws nothing around
              it —, which matters more than usual here: remounting this div
              would drop the virtualizer along with the scroll and the
              selection.

              `modal={false}` because Radix's modal menu locks the DOCUMENT's
              scroll, and what scrolls here is the grid canvas. */}
          <ContextMenu modal={false}>
            <ContextMenuTrigger asChild>
              <div
                ref={scrollRef}
                tabIndex={0}
                role="grid"
                aria-rowcount={rowCount}
                aria-colcount={visibleColumns.length}
                onKeyDown={onKeyDown}
                onContextMenu={(e) => {
                  setContextMenuEpoch((n) => n + 1);
                  setContextMenuLink(
                    e.target instanceof Element
                      ? linkTarget(e.target, window.location.origin)
                      : null,
                  );
                }}
                className="grid-scrollbar relative flex-1 overflow-auto overscroll-contain outline-none"
              >
                <div
                  className="relative min-h-full"
                  style={{ width: canvasWidth, minWidth: "100%" }}
                >
                  <GridHeader />
                  {rowCount === 0 && isFetching ? (
                    <GridLoadingState />
                  ) : rowCount > 0 ? (
                    <div
                      className={cn(
                        "relative transition-opacity duration-200",
                        isRefreshing && "opacity-50",
                      )}
                      style={{ height: virtualizer.getTotalSize() }}
                    >
                      <SelectionOverlay />
                      <GridBody items={items} getRow={getRow} />
                    </div>
                  ) : null}
                  {colDropTarget != null && (
                    <div
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-basecast-brand"
                      style={{
                        zIndex: Z_DROPLINE,
                        left: GUTTER_WIDTH + colOffsets[colDropTarget] - 1,
                      }}
                    />
                  )}
                </div>
              </div>
            </ContextMenuTrigger>
            <GridContextMenuContent
              key={contextMenuEpoch}
              onCopy={handleCopy}
              link={contextMenuLink}
            />
          </ContextMenu>
          <GridStatusBar
            totalCount={totalCount}
            rowCount={rowCount}
            getRow={getRow}
            summary={summary}
            isFetching={isFetching}
            selectionStats={selectionStats}
          />
        </div>
      </div>
    </GridContext.Provider>
  );
}
