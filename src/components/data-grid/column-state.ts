import { MAX_COL_WIDTH, MIN_COL_WIDTH } from "./constants";
import type { GridColumn, GridColumnState } from "./types";

/** The layout every grid starts from: base order, nothing hidden, no overrides. */
export function defaultColumnState<TData>(
  columns: GridColumn<TData>[],
): GridColumnState {
  return { order: columns.map((c) => c.id), hidden: [], widths: {}, frozen: 0 };
}

/**
 * How many columns may be frozen: every VISIBLE unpinned column but one.
 * Freezing the last scrollable column away would leave a sheet that cannot be
 * scrolled horizontally at all, with no control left to undo it.
 */
function maxFrozen<TData>(
  columns: GridColumn<TData>[],
  order: string[],
  hidden: string[],
): number {
  const byId = new Map(columns.map((c) => [c.id, c]));
  const hiddenSet = new Set(hidden);
  let visible = 0;
  for (const id of order) {
    const col = byId.get(id);
    if (!col || hiddenSet.has(id) || col.pinned === "right") continue;
    visible++;
  }
  return Math.max(0, visible - 1);
}

/**
 * Normalize a (possibly stale) column state against the current base columns
 * — saved views may reference columns that were renamed/removed, or miss
 * columns added since. Unknown ids are dropped, missing ids appended in base
 * order, widths clamped, and at least one column is kept visible.
 */
export function sanitizeColumnState<TData>(
  state: GridColumnState,
  columns: GridColumn<TData>[],
): GridColumnState {
  const known = new Set(columns.map((c) => c.id));
  const order = state.order.filter(
    (id, i) => known.has(id) && state.order.indexOf(id) === i,
  );
  const ordered = new Set(order);
  for (const col of columns) {
    if (!ordered.has(col.id)) {
      ordered.add(col.id);
      order.push(col.id);
    }
  }
  let hidden = state.hidden.filter((id) => known.has(id));
  if (hidden.length >= order.length) hidden = [];
  const widths: Record<string, number> = {};
  for (const [id, w] of Object.entries(state.widths)) {
    if (known.has(id) && Number.isFinite(w)) {
      widths[id] = Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, w));
    }
  }
  const frozen = Math.max(
    0,
    Math.min(
      Math.trunc(state.frozen ?? 0) || 0,
      maxFrozen(columns, order, hidden),
    ),
  );
  return { order, hidden, widths, frozen };
}

/**
 * Spreadsheet column name for a 0-based position: 0 → "A", 25 → "Z",
 * 26 → "AA", 701 → "ZZ", 702 → "AAA". The title of a positional column (a raw
 * spreadsheet shown as the file has it, before any header is inferred).
 */
export function spreadsheetColumnName(index: number): string {
  if (!Number.isInteger(index) || index < 0) {
    throw new RangeError(`Column index must be a non-negative integer: ${index}`);
  }
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}
