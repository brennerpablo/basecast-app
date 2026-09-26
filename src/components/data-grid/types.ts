/**
 * Read-only spreadsheet grid (`<DataGrid>`): virtualized rows over a sparse
 * server-backed window, Sheets-style cell/row/column selection, keyboard
 * navigation, clipboard copy and Excel-style per-column filters. Sorting and
 * filtering run wherever the caller runs them (the server, through
 * `useGridWindowQuery`, or memory, through `useClientGridSource`) — the grid
 * only renders what the caller's `getRow` accessor can resolve.
 */

import type * as React from "react";

export type GridColumnType = "text" | "number" | "date";

/**
 * Turns a cell into a link or an action instead of plain text. The cell is
 * still a real grid cell — selectable, and copy/export use the column's raw
 * value (or `copyValue`) — but the link/button owns its click (a
 * `data-grid-cell-action` marker keeps the grid's selection from swallowing
 * it).
 *
 * Navigation is ALWAYS a real anchor: an app path renders a Next `<Link>`
 * (same tab, so the app's tab strip records it and the right-click menu offers
 * "Open in new tab"), an absolute URL renders `<a target="_blank">`. Never use
 * `onClick` to navigate.
 */
export type GridCellAction<TData> = {
  /**
   * Icon-only cell (lucide-react icons match this signature). Omit it and the
   * link shows the cell's own text — the "name that opens its detail" cell.
   */
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Tooltip + aria-label (static, or derived from the row). Required in
   * practice for icon cells; a text link falls back to its text.
   */
  label?: string | ((row: TData) => string);
  /**
   * Destination built from the row. Null/empty renders the plain text (or
   * nothing, for an icon cell).
   */
  href?: (row: TData) => string | null | undefined;
  /** Open an app path in a new BROWSER tab (`target="_blank"`) instead. */
  newTab?: boolean;
  /**
   * Next `<Link prefetch>`. Off by default: a virtualized sheet mounts dozens
   * of links per scroll frame, and viewport prefetching would fire a request
   * for each one.
   */
  prefetch?: boolean;
  /** Renders a `<button>` firing this, when there is no `href`. Not for navigation. */
  onClick?: (row: TData) => void;
  /**
   * Escape hatch: render arbitrary content (e.g. a dropdown-menu trigger)
   * instead of the plain link/icon. Takes precedence over `href`/`onClick`.
   * The grid wraps it in a `data-grid-cell-action` element so clicks never
   * start a selection; any menu should portal outside the grid (Radix does by
   * default).
   */
  render?: (row: TData) => React.ReactNode;
};

/**
 * How a column's filter popover state maps onto the API's query params.
 * Only the shapes the server can serve from an index are expressible.
 */
export type GridFilterParamMap = {
  /** Checkbox multi-select values → list query param (see `GRID_LIST_SEPARATOR`). */
  csv?: string;
  /** Text `contains` condition → query param (the UI requires ≥3 chars). */
  contains?: string;
  /** Text `starts with` (prefix) condition → query param. */
  startsWith?: string;
  /** Exact-equality condition → query param. */
  equals?: string;
  /** Range condition → min/max query params (numbers or ISO dates). */
  range?: { min?: string; max?: string };
};

export type GridColumnFilterConfig = {
  /** Key into the grid's `filterOptions` prop for the checkbox value list. */
  optionsKey?: string;
  /** Enables the condition section of the popover, typed like the column. */
  conditions?: GridColumnType;
  paramMap: GridFilterParamMap;
};

export type GridColumn<TData> = {
  /**
   * Row-object key; also the sort id sent to the server. For positional rows
   * (arrays, e.g. a raw spreadsheet), use the index as a string: "0", "1", …
   */
  id: string;
  title: string;
  type: GridColumnType;
  /** Default width in px; the user's resize lives in `GridColumnState.widths`. */
  width: number;
  /** Defaults to "right" for `type: "number"`, "left" otherwise. */
  align?: "left" | "right";
  /** Monospace text (codes, ids, hashes, raw file cells). */
  mono?: boolean;
  /**
   * Offer sort in the column menu. Off by default — a positional view (a raw
   * spreadsheet) has no order but the file's; on a server grid the id must be
   * whitelisted by the API.
   */
  sortable?: boolean;
  filter?: GridColumnFilterConfig;
  /**
   * Freeze this column to the right edge (mirror of the left row-number
   * gutter). Pinned columns render in a sticky lane and are display-only —
   * outside cell selection, keyboard nav, sort and reorder. Meant for
   * action/link icon columns.
   *
   * Freezing to the LEFT is not this: it is `GridColumnState.frozen`, a count
   * the user drives from the column menu, and the columns inside that lane
   * stay full members of the grid (selectable, copyable, exportable). The
   * asymmetry is real — a right lane of icon buttons has nothing to select.
   */
  pinned?: "right";
  /** Renders a link/action instead of plain text; copy/export still use the raw value. */
  action?: GridCellAction<TData>;
  /** Display string (cells render plain text — keep it cheap). */
  format?: (value: unknown, row: TData) => string;
  /** Raw value for clipboard TSV and export (default `String(value)`). */
  copyValue?: (value: unknown, row: TData) => string;
};

export type CellCoord = { row: number; col: number };

/** Inclusive, normalized selection rectangle. */
export type GridRect = { r0: number; r1: number; c0: number; c1: number };

export type GridConditionOp =
  | "startsWith"
  | "contains"
  | "eq"
  | "gte"
  | "lte"
  | "between";

export type GridColumnFilter = {
  /** Checked values of the checkbox section; absent = all values. */
  values?: string[];
  condition?: { op: GridConditionOp; value: string; value2?: string };
};

/** Active filters by column id. */
export type GridFilterState = Record<string, GridColumnFilter>;

export type GridSortState = { id: string; desc: boolean } | null;

export type GridFilterOption = { value: string; label: string };

/**
 * User-adjustable column layout, controlled by the caller like
 * filters/sorting. `order` always contains ALL column ids (hidden included);
 * the grid derives its visible columns from it — internal index math only
 * ever sees contiguous visible indices.
 */
export type GridColumnState = {
  /** All column ids in display order (hidden ones included). */
  order: string[];
  /** Hidden column ids. */
  hidden: string[];
  /** Width overrides by id; falls back to GridColumn.width. */
  widths: Record<string, number>;
  /**
   * How many LEADING visible columns are frozen to the left edge ("freeze up
   * to this column", Sheets-style). Absent/0 = none.
   *
   * A count and not a set of ids, because that is what the freeze IS: a
   * boundary in display order. Freezing a scattered set of columns would have
   * to reorder them anyway, and a count survives reorder/hide without ever
   * naming a column that moved. Frozen columns stay full members of the data
   * grid — selectable, sortable, copied, exported — they simply render in a
   * sticky lane whose flow width equals `colOffsets[frozen]`, so every index
   * calculation downstream is untouched.
   */
  frozen?: number;
};

/** Per-column aggregate of a selection — see DataGrid's `selectionStats`. */
export type GridAggregate = {
  count: number;
  sum: number | null;
  min: number | null;
  max: number | null;
};

/** A named snapshot of the grid's filter + sort state (see views-storage). */
export type SavedView = {
  name: string;
  filters: GridFilterState;
  sorting: GridSortState;
  /** Column layout at save time. */
  columns?: GridColumnState;
  /** ISO timestamp of the last save. */
  savedAt: string;
};
