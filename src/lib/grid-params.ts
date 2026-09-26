import type {
  GridColumn,
  GridFilterState,
  GridSortState,
} from "@/components/data-grid";

/**
 * Shared serializer for the spreadsheet grids: turns column filter/sort state
 * (plus any screen-specific `extra` params, like a snapshot date or a source
 * id) into the block route's querystring.
 *
 * The output is stable-ordered (keys sorted, list values sorted), so it
 * doubles as the block-cache namespace AND the grid's reset token — identical
 * state always produces the identical string.
 *
 * Params the block route itself owns, which no `paramMap` may reuse:
 * `offset`, `limit`, `withSummary` (added per block by `useGridWindowQuery`)
 * and `sort`/`dir` (added here from the sort state).
 */

// Multi-value lists ride a single param joined by the ASCII unit separator, so
// values that contain commas/pipes (free-text source data) survive the round
// trip. Every grid route splits on the same character.
export const GRID_LIST_SEPARATOR = String.fromCharCode(31); // U+001F

export function buildGridParams<T>(
  columns: GridColumn<T>[],
  filters: GridFilterState,
  sorting: GridSortState,
  extra: [string, string][] = [],
): string {
  const params: [string, string][] = [...extra];
  if (sorting) {
    params.push(["sort", sorting.id], ["dir", sorting.desc ? "desc" : "asc"]);
  }
  const paramMapByColumnId = new Map(
    columns.map((c) => [c.id, c.filter?.paramMap]),
  );
  for (const [colId, f] of Object.entries(filters)) {
    const pm = paramMapByColumnId.get(colId);
    if (!pm) continue;
    if (f.values?.length && pm.csv) {
      params.push([pm.csv, [...f.values].sort().join(GRID_LIST_SEPARATOR)]);
    }
    const cond = f.condition;
    if (!cond) continue;
    const range = pm.range;
    switch (cond.op) {
      case "startsWith":
        if (pm.startsWith) params.push([pm.startsWith, cond.value]);
        break;
      case "contains":
        if (pm.contains) params.push([pm.contains, cond.value]);
        break;
      case "eq":
        if (pm.equals) params.push([pm.equals, cond.value]);
        else if (range?.min && range?.max) {
          params.push([range.min, cond.value], [range.max, cond.value]);
        }
        break;
      case "gte":
        if (range?.min) params.push([range.min, cond.value]);
        break;
      case "lte":
        if (range?.max) params.push([range.max, cond.value]);
        break;
      case "between":
        if (range?.min && cond.value) params.push([range.min, cond.value]);
        if (range?.max && cond.value2) {
          params.push([range.max, cond.value2]);
        }
        break;
    }
  }
  // Code-point order, not `localeCompare`: the string is a cache key, and it
  // must not depend on the browser's locale. `sort` is stable, so equal keys
  // keep their insertion order.
  params.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return params
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
}
