"use client";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { reorder } from "@atlaskit/pragmatic-drag-and-drop/reorder";
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import {
  Bookmark,
  Columns3,
  Download,
  GripVertical,
  Loader2,
  Maximize2,
  Minimize2,
  Redo2,
  Rows3,
  Save,
  Search,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { defaultColumnState, sanitizeColumnState } from "./column-state";
import { DENSITIES, type GridDensity } from "./constants";
import { exportRowsToCSV, exportRowsToXLSX } from "./export";
import { foldIncludes } from "./fold-text";
import { useGridContext } from "./grid-context";
import { type GridStrings, intFormat } from "./i18n";
import type {
  GridColumn,
  GridColumnState,
  GridFilterState,
  GridSortState,
  SavedView,
} from "./types";
import { loadViews, saveViews } from "./views-storage";

/**
 * Human-readable one-line summary of a filter+sort state — used as the
 * default name for a saved view when the user leaves the name blank
 * ("City: MIAMI +2 · Amount greater or equal 100000").
 */
function summarizeView(
  filters: GridFilterState,
  sorting: GridSortState,
  columns: readonly { id: string; title: string }[],
  strings: GridStrings,
): string {
  const titleOf = (id: string) =>
    columns.find((c) => c.id === id)?.title ?? id;
  const parts: string[] = [];
  for (const [colId, f] of Object.entries(filters)) {
    const title = titleOf(colId);
    if (f.values?.length) {
      const [first, ...rest] = f.values;
      parts.push(rest.length ? `${title}: ${first} +${rest.length}` : `${title}: ${first}`);
    }
    if (f.condition) {
      const { op, value, value2 } = f.condition;
      parts.push(
        op === "between"
          ? `${title}: ${value || "…"}–${value2 || "…"}`
          : `${title} ${strings.opLabels[op]} ${value}`,
      );
    }
  }
  if (parts.length === 0) {
    return sorting
      ? strings.sortedBy(titleOf(sorting.id), sorting.desc)
      : strings.allRows;
  }
  return parts.join(" · ");
}

/** Toolbar features, all optional. Omitting `toolbar` on DataGrid hides it. */
export type GridToolbarConfig<TData> = {
  export?: {
    /**
     * Fetch the full filtered dataset (the grid only holds ~viewport blocks,
     * so it can't export from its own cache). `onProgress(done, total)`
     * drives the progress toast.
     */
    fetchRows: (
      onProgress: (done: number, total: number) => void,
    ) => Promise<TData[]>;
    /** Base filename, no extension. */
    filename: string;
    /** Uncapped filtered total, for the "exported X of Y" warning. */
    totalCount: number;
  };
  /** Show the fullscreen toggle (default true when `toolbar` is set). */
  fullscreen?: boolean;
  savedViews?: { storageKey: string };
};

type GridToolbarProps<TData> = {
  config: GridToolbarConfig<TData>;
  /** VISIBLE columns in display order (export, summaries). */
  columns: GridColumn<TData>[];
  /** Full base column set (column picker, saved-view sanitizing). */
  allColumns: GridColumn<TData>[];
  columnState: GridColumnState;
  onColumnStateChange: (s: GridColumnState) => void;
  filters: GridFilterState;
  onFiltersChange: (f: GridFilterState) => void;
  sorting: GridSortState;
  onSortingChange: (s: GridSortState) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  /** null = the grid's own default height. */
  density: GridDensity | null;
  onDensityChange: (d: GridDensity) => void;
  onFind: () => void;
  /** View history — see `use-grid-history.ts`. */
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
};

export function GridToolbar<TData>({
  config,
  columns,
  allColumns,
  columnState,
  onColumnStateChange,
  filters,
  onFiltersChange,
  sorting,
  onSortingChange,
  isFullscreen,
  onToggleFullscreen,
  density,
  onDensityChange,
  onFind,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
}: GridToolbarProps<TData>) {
  const { strings } = useGridContext();
  const filterCount = Object.keys(filters).length;

  return (
    <div className="flex h-10 shrink-0 items-center gap-2 rounded-md border bg-background px-2">
      {filterCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>{strings.filterCount(filterCount)}</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-1.5 text-xs"
            onClick={() => onFiltersChange({})}
          >
            <X className="size-3" />
            {strings.clear}
          </Button>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
        {config.savedViews && (
          <ViewsMenu
            storageKey={config.savedViews.storageKey}
            columns={allColumns}
            columnState={columnState}
            filters={filters}
            sorting={sorting}
            onApply={(view) => {
              onFiltersChange(view.filters);
              onSortingChange(view.sorting);
              // Views saved before column layouts existed leave it untouched.
              if (view.columns) {
                onColumnStateChange(
                  sanitizeColumnState(view.columns, allColumns),
                );
              }
            }}
          />
        )}

        <ColumnsMenu
          allColumns={allColumns}
          columnState={columnState}
          onColumnStateChange={onColumnStateChange}
        />

        {/* A plain rule and not `Separator`: that one is `h-full` on the
            vertical axis, which collapses inside this auto-height flex row. */}
        <div aria-hidden className="mx-1 h-5 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={!canUndo}
          onClick={onUndo}
          title={strings.undo}
          aria-label={strings.undo}
        >
          <Undo2 className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={!canRedo}
          onClick={onRedo}
          title={strings.redo}
          aria-label={strings.redo}
        >
          <Redo2 className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onFind}
          title={strings.find}
          aria-label={strings.findAria}
        >
          <Search className="size-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              title={strings.density}
              aria-label={strings.density}
            >
              <Rows3 className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {DENSITIES.map((d) => (
              <DropdownMenuItem
                key={d.id}
                onSelect={() => onDensityChange(d.id)}
              >
                {strings.densityLabels[d.id]}
                {(density ?? "default") === d.id && (
                  <span className="ml-auto text-basecast-brand">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {config.export && (
          <ExportMenu
            exportConfig={config.export}
            columns={columns}
          />
        )}

        {config.fullscreen !== false && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onToggleFullscreen}
            title={isFullscreen ? strings.exitFullscreen : strings.fullscreen}
            aria-label={
              isFullscreen ? strings.exitFullscreen : strings.fullscreen
            }
          >
            {isFullscreen ? (
              <Minimize2 className="size-4" />
            ) : (
              <Maximize2 className="size-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

function ExportMenu<TData>({
  exportConfig,
  columns,
}: {
  exportConfig: NonNullable<GridToolbarConfig<TData>["export"]>;
  columns: GridColumn<TData>[];
}) {
  const { strings, language } = useGridContext();
  const intFmt = intFormat(language);
  const [exporting, setExporting] = React.useState(false);

  const runExport = async (kind: "csv" | "xlsx") => {
    if (exporting) return;
    const { fetchRows, filename, totalCount } = exportConfig;
    setExporting(true);
    const id = "grid-export";
    toast.loading(strings.exporting(0), { id });
    try {
      const rows = await fetchRows((done, total) => {
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        toast.loading(strings.exporting(pct), { id });
      });
      if (!rows.length) {
        toast.warning(strings.nothingToExport, { id });
        return;
      }
      if (kind === "csv") await exportRowsToCSV(rows, columns, filename);
      else await exportRowsToXLSX(rows, columns, filename);
      if (rows.length < totalCount) {
        toast.warning(
          strings.exportedPartial(
            intFmt.format(rows.length),
            intFmt.format(totalCount),
          ),
          { id },
        );
      } else {
        toast.success(strings.exportedAll(intFmt.format(rows.length)), { id });
      }
    } catch {
      toast.error(strings.exportFailed, { id });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={exporting}
          title={strings.exportLabel}
          aria-label={strings.exportLabel}
        >
          {exporting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void runExport("csv")}>
          {strings.exportCsv}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void runExport("xlsx")}>
          {strings.exportXlsx}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ViewsMenu<TData>({
  storageKey,
  columns,
  columnState,
  filters,
  sorting,
  onApply,
}: {
  storageKey: string;
  columns: GridColumn<TData>[];
  columnState: GridColumnState;
  filters: GridFilterState;
  sorting: GridSortState;
  onApply: (view: SavedView) => void;
}) {
  const { strings } = useGridContext();
  const [open, setOpen] = React.useState(false);
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [name, setName] = React.useState("");

  // localStorage is client-only — seed after mount, and re-read on every
  // open so the list can't go stale (e.g. saved in another tab).
  React.useEffect(() => {
    setViews(loadViews(storageKey));
  }, [storageKey]);

  // The name is optional; blank saves under an auto-summary of the filters.
  const autoSummary = React.useMemo(
    () => summarizeView(filters, sorting, columns, strings),
    [filters, sorting, columns, strings],
  );

  const persist = (next: SavedView[]) => {
    if (!saveViews(storageKey, next)) {
      toast.error(strings.viewTooLarge);
      return false;
    }
    setViews(next);
    return true;
  };

  const handleSave = () => {
    const label = name.trim() || autoSummary;
    const view: SavedView = {
      name: label,
      filters,
      sorting,
      columns: columnState,
      savedAt: new Date().toISOString(),
    };
    // Upsert by name (saving over an existing name overwrites it).
    const next = [
      ...views.filter((v) => v.name !== label),
      view,
    ].sort((a, b) => a.name.localeCompare(b.name));
    if (persist(next)) {
      setName("");
      toast.success(strings.savedViewToast(label));
    }
  };

  const handleDelete = (viewName: string) => {
    persist(views.filter((v) => v.name !== viewName));
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setViews(loadViews(storageKey));
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Bookmark className="size-4" />
          {strings.savedViews}
          {views.length > 0 && (
            <span className="ml-0.5 rounded bg-muted px-1 tabular-nums">
              {views.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 text-sm">
        <div className="max-h-64 overflow-y-auto p-1">
          {views.length === 0 ? (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              {strings.noSavedViews}
            </p>
          ) : (
            views.map((view) => (
              <div
                key={view.name}
                className="group flex items-center gap-1 rounded hover:bg-accent"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-xs"
                  title={view.name}
                  onClick={() => {
                    onApply(view);
                    setOpen(false);
                  }}
                >
                  {view.name}
                </button>
                <button
                  type="button"
                  aria-label={strings.deleteView(view.name)}
                  className="mr-1 shrink-0 rounded p-1 text-muted-foreground opacity-0 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(view.name);
                  }}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
        <Separator />
        <div className="space-y-1.5 p-2">
          <div className="text-[11px] text-muted-foreground">
            {strings.saveCurrentFilters}
          </div>
          <div className="flex items-center gap-2">
            <Input
              className="h-8 text-xs"
              placeholder={autoSummary}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
            <Button size="sm" className="h-8" onClick={handleSave}>
              <Save className="size-3.5" />
              {strings.save}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// ColumnsMenu — visibility + reorder panel ("Columns"). Reorder uses
// pragmatic-drag-and-drop with closest-edge hit-testing (lean version of the
// pattern in the DataTable's column options).
// ---------------------------------------------------------------------------

const columnItemKey = Symbol("grid-column-item");

type ColumnItemData = {
  [columnItemKey]: true;
  id: string;
  index: number;
  instanceId: symbol;
};

function isColumnItemData(
  data: Record<string | symbol, unknown>,
): data is ColumnItemData {
  return data[columnItemKey] === true;
}

function ColumnsMenu<TData>({
  allColumns,
  columnState,
  onColumnStateChange,
}: {
  allColumns: GridColumn<TData>[];
  columnState: GridColumnState;
  onColumnStateChange: (s: GridColumnState) => void;
}) {
  const { strings } = useGridContext();
  const [search, setSearch] = React.useState("");
  const instanceId = React.useMemo(() => Symbol("columns-menu"), []);

  const byId = React.useMemo(
    () => new Map(allColumns.map((c) => [c.id, c])),
    [allColumns],
  );
  const hiddenSet = React.useMemo(
    () => new Set(columnState.hidden),
    [columnState.hidden],
  );
  const visibleCount = columnState.order.filter(
    (id) => byId.has(id) && !hiddenSet.has(id),
  ).length;
  const hiddenCount = columnState.hidden.length;

  // Reordering while the list is search-filtered would reorder against wrong
  // indexes — disable dragging under a search instead.
  // Folded, so "resume" finds the column titled "Résumé".
  const needle = search.trim();
  const dragDisabled = needle.length > 0;

  // Commit a drop: indexes are positions in the FULL order array.
  React.useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) =>
        isColumnItemData(source.data) && source.data.instanceId === instanceId,
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0];
        if (!target || !isColumnItemData(source.data)) return;
        const targetData = target.data;
        if (!isColumnItemData(targetData)) return;
        const edge: Edge | null = extractClosestEdge(targetData);
        const finishIndex = getReorderDestinationIndex({
          startIndex: source.data.index,
          indexOfTarget: targetData.index,
          closestEdgeOfTarget: edge,
          axis: "vertical",
        });
        if (finishIndex === source.data.index) return;
        onColumnStateChange({
          ...columnState,
          order: reorder({
            list: columnState.order,
            startIndex: source.data.index,
            finishIndex,
          }),
        });
      },
    });
  }, [instanceId, columnState, onColumnStateChange]);

  const toggleHidden = (id: string) => {
    const hidden = hiddenSet.has(id)
      ? columnState.hidden.filter((h) => h !== id)
      : [...columnState.hidden, id];
    onColumnStateChange({ ...columnState, hidden });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <Columns3 className="size-4" />
          {strings.columns}
          {hiddenCount > 0 && (
            <span className="ml-0.5 rounded bg-muted px-1 tabular-nums">
              {visibleCount}/{columnState.order.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0 text-sm">
        <div className="p-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-7 text-xs"
              placeholder={strings.searchColumn}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {columnState.order.map((id, index) => {
            const col = byId.get(id);
            if (!col) return null;
            if (needle && !foldIncludes(col.title, needle)) {
              return null;
            }
            const visible = !hiddenSet.has(id);
            return (
              <ColumnRow
                key={id}
                id={id}
                title={col.title}
                index={index}
                instanceId={instanceId}
                visible={visible}
                // Never allow hiding the last visible column.
                toggleDisabled={visible && visibleCount <= 1}
                dragDisabled={dragDisabled}
                onToggle={() => toggleHidden(id)}
              />
            );
          })}
        </div>
        <Separator />
        <div className="flex justify-end p-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() =>
              onColumnStateChange(defaultColumnState(allColumns))
            }
          >
            {strings.restoreDefault}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnRow({
  id,
  title,
  index,
  instanceId,
  visible,
  toggleDisabled,
  dragDisabled,
  onToggle,
}: {
  id: string;
  title: string;
  index: number;
  instanceId: symbol;
  visible: boolean;
  toggleDisabled: boolean;
  dragDisabled: boolean;
  onToggle: () => void;
}) {
  const { strings } = useGridContext();
  const rowRef = React.useRef<HTMLDivElement>(null);
  const handleRef = React.useRef<HTMLButtonElement>(null);
  const [closestEdge, setClosestEdge] = React.useState<Edge | null>(null);
  const [dragging, setDragging] = React.useState(false);

  React.useEffect(() => {
    const row = rowRef.current;
    const handle = handleRef.current;
    if (!row || !handle || dragDisabled) return;

    const data: ColumnItemData = {
      [columnItemKey]: true,
      id,
      index,
      instanceId,
    };

    return combine(
      draggable({
        element: handle,
        getInitialData: () => data,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: row,
        canDrop: ({ source }) =>
          isColumnItemData(source.data) &&
          source.data.instanceId === instanceId,
        getData: ({ input }) =>
          attachClosestEdge(data, {
            element: row,
            input,
            allowedEdges: ["top", "bottom"],
          }),
        onDrag: ({ self, source }) => {
          if (source.element === handle) {
            setClosestEdge(null);
            return;
          }
          setClosestEdge(extractClosestEdge(self.data));
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [id, index, instanceId, dragDisabled]);

  return (
    <div
      ref={rowRef}
      className={cn(
        "relative flex items-center gap-2 rounded px-2 py-1 hover:bg-accent",
        dragging && "opacity-50",
      )}
    >
      <Checkbox
        checked={visible}
        disabled={toggleDisabled}
        onCheckedChange={onToggle}
      />
      <span className="min-w-0 flex-1 truncate text-xs" title={title}>
        {title}
      </span>
      <button
        ref={handleRef}
        type="button"
        tabIndex={-1}
        aria-label={strings.reorderColumn(title)}
        disabled={dragDisabled}
        title={dragDisabled ? strings.clearSearchToReorder : undefined}
        className={cn(
          "shrink-0 cursor-grab rounded p-0.5 text-muted-foreground active:cursor-grabbing",
          dragDisabled && "cursor-not-allowed opacity-30",
        )}
      >
        <GripVertical className="size-4" />
      </button>
      {closestEdge && <DropIndicator edge={closestEdge} gap="1px" />}
    </div>
  );
}
