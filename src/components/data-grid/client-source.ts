"use client";

import * as React from "react";

import { foldText } from "./fold-text";
import type { GridStatusSummary } from "./status-bar";
import type {
  GridColumn,
  GridFilterOption,
  GridFilterState,
  GridSortState,
} from "./types";

/**
 * In-memory data source for `<DataGrid>` — the batteries-included client mode.
 *
 * The grid is server-oriented by contract (sparse `getRow` + windowed block
 * fetching). This hook lets you drive it from a plain array instead: it applies
 * the controlled `sorting`/`filters` locally and returns exactly the data props
 * the grid needs, plus a `resetToken`, a `fetchRows` for the toolbar export, and
 * `filterOptions` derived from the data. Virtualization still applies, so a few
 * thousand rows stay smooth. For large/remote datasets, feed the grid from your
 * own paginated source instead.
 *
 * Filtering is interpreted generically from the column `type` + `id` (checkbox
 * value lists, and `startsWith`/`contains`/`eq`/`gte`/`lte`/`between`
 * conditions; text matches fold case and accents). Checkbox
 * `filterOptions` are keyed by each column's `filter.optionsKey` and derived
 * from the distinct values in `rows`.
 */

export type ClientGridSource<TData> = {
  getRow: (index: number) => TData | undefined;
  rowCount: number;
  totalCount: number;
  /** No-op — every row is already resident. Wired for the grid's contract. */
  onViewportChange: (startRow: number, endRow: number) => void;
  filterOptions: Record<string, GridFilterOption[]>;
  summary: GridStatusSummary | null;
  /** Changes with sorting/filters — pass to the grid's `resetToken`. */
  resetToken: string;
  /** Returns the current filtered+sorted rows — pass to `toolbar.export.fetchRows`. */
  fetchRows: () => Promise<TData[]>;
};

type Row = Record<string, unknown>;

const isBlank = (v: unknown) => v == null || v === "";

function matchesFilters<TData extends Row>(
  row: TData,
  columns: GridColumn<TData>[],
  filters: GridFilterState,
): boolean {
  for (const [colId, f] of Object.entries(filters)) {
    const col = columns.find((c) => c.id === colId);
    if (!col) continue;
    const raw = row[colId];

    // Checkbox value list.
    if (f.values && f.values.length) {
      if (!f.values.includes(String(raw ?? ""))) return false;
    }

    // Typed condition.
    const c = f.condition;
    if (c && (c.value !== "" || (c.op === "between" && c.value2))) {
      if (col.type === "number") {
        const n = Number(raw);
        const v = Number(c.value);
        const v2 = Number(c.value2);
        if (Number.isNaN(n)) return false;
        switch (c.op) {
          case "eq":
            if (n !== v) return false;
            break;
          case "gte":
            if (!(n >= v)) return false;
            break;
          case "lte":
            if (!(n <= v)) return false;
            break;
          case "between":
            if (c.value !== "" && !(n >= v)) return false;
            if (c.value2 && !(n <= v2)) return false;
            break;
          case "contains":
            if (!String(raw).includes(c.value)) return false;
            break;
        }
      } else if (col.type === "date") {
        const s = String(raw ?? "").slice(0, 10);
        switch (c.op) {
          case "eq":
            if (s !== c.value) return false;
            break;
          case "gte":
            if (!(s >= c.value)) return false;
            break;
          case "lte":
            if (!(s <= c.value)) return false;
            break;
          case "between":
            if (c.value && !(s >= c.value)) return false;
            if (c.value2 && !(s <= c.value2)) return false;
            break;
          case "contains":
            if (!s.includes(c.value)) return false;
            break;
        }
      } else {
        // Folded like the grid's own searches: case and accents never decide
        // whether a text condition matches.
        const s = foldText(String(raw ?? ""));
        const v = foldText(c.value);
        if (c.op === "eq") {
          if (s !== v) return false;
        } else if (c.op === "startsWith") {
          if (!s.startsWith(v)) return false;
        } else if (!s.includes(v)) {
          return false;
        }
      }
    }
  }
  return true;
}

function makeComparator<TData extends Row>(
  col: GridColumn<TData>,
  desc: boolean,
) {
  return (a: TData, b: TData): number => {
    const av = a[col.id];
    const bv = b[col.id];
    const an = isBlank(av);
    const bn = isBlank(bv);
    // Nulls/blanks always sort last, regardless of direction.
    if (an && bn) return 0;
    if (an) return 1;
    if (bn) return -1;
    const base =
      col.type === "number"
        ? Number(av) - Number(bv)
        : String(av).localeCompare(String(bv));
    return desc ? -base : base;
  };
}

export function useClientGridSource<TData extends Row>(opts: {
  rows: TData[];
  columns: GridColumn<TData>[];
  sorting: GridSortState;
  filters: GridFilterState;
  /** Numeric column id to aggregate for the status-bar summary (count/total/mean). */
  summaryColumn?: string;
}): ClientGridSource<TData> {
  const { rows, columns, sorting, filters, summaryColumn } = opts;

  // Distinct-value lists for every column exposing a checkbox filter.
  const filterOptions = React.useMemo(() => {
    const out: Record<string, GridFilterOption[]> = {};
    for (const col of columns) {
      const key = col.filter?.optionsKey;
      if (!key) continue;
      const seen = new Set<string>();
      for (const row of rows) {
        const v = row[col.id];
        if (isBlank(v)) continue;
        seen.add(String(v));
      }
      out[key] = [...seen]
        .sort((a, b) => a.localeCompare(b))
        .map((value) => ({ value, label: value }));
    }
    return out;
  }, [rows, columns]);

  const processed = React.useMemo(() => {
    const filtered = Object.keys(filters).length
      ? rows.filter((r) => matchesFilters(r, columns, filters))
      : rows.slice();
    if (sorting) {
      const col = columns.find((c) => c.id === sorting.id);
      if (col) filtered.sort(makeComparator(col, sorting.desc));
    }
    return filtered;
  }, [rows, columns, filters, sorting]);

  const summary = React.useMemo<GridStatusSummary | null>(() => {
    if (!summaryColumn) return null;
    let sum = 0;
    let n = 0;
    for (const row of processed) {
      const v = Number(row[summaryColumn]);
      if (Number.isFinite(v)) {
        sum += v;
        n++;
      }
    }
    return {
      count: processed.length,
      total: n ? sum : null,
      mean: n ? sum / n : null,
    };
  }, [processed, summaryColumn]);

  const getRow = React.useCallback(
    (index: number): TData | undefined => processed[index],
    [processed],
  );

  const onViewportChange = React.useCallback(() => {}, []);

  const fetchRows = React.useCallback(
    async () => processed.slice(),
    [processed],
  );

  const resetToken = React.useMemo(
    () => JSON.stringify({ sorting, filters }),
    [sorting, filters],
  );

  return {
    getRow,
    rowCount: processed.length,
    totalCount: processed.length,
    onViewportChange,
    filterOptions,
    summary,
    resetToken,
    fetchRows,
  };
}
