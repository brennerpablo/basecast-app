import type { GridDensity } from "./constants";
import type { GridConditionOp } from "./types";

/**
 * UI text for the DataGrid chrome (toolbar, filter menus, status bar, empty
 * state, clipboard toasts). The resolved strings + locale ride the grid
 * context so every subcomponent reads them from one place.
 *
 * Only English ships. The table stays behind `GridLanguage` so adding a locale
 * is one more `GridStrings` object, not a hunt through every component.
 */

export type GridLanguage = "en";

const LOCALES: Record<GridLanguage, string> = { en: "en-US" };

/** Intl locale used for every number the grid formats. */
export const localeFor = (lang: GridLanguage): string => LOCALES[lang] ?? "en-US";

const intFormats = new Map<string, Intl.NumberFormat>();
const numFormats = new Map<string, Intl.NumberFormat>();

/** Integer formatter for counts ("1,234 rows"), cached per locale. */
export function intFormat(lang: GridLanguage): Intl.NumberFormat {
  const locale = localeFor(lang);
  let fmt = intFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale);
    intFormats.set(locale, fmt);
  }
  return fmt;
}

/**
 * Plain number formatter for aggregates, cached per locale. Selections can mix
 * currency and unit columns, so plain numbers are the only universally correct
 * format for them (like Excel's status bar).
 */
export function numFormat(lang: GridLanguage): Intl.NumberFormat {
  const locale = localeFor(lang);
  let fmt = numFormats.get(locale);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
    numFormats.set(locale, fmt);
  }
  return fmt;
}

export type GridStrings = {
  // toolbar
  filterCount: (n: number) => string;
  clear: string;
  savedViews: string;
  noSavedViews: string;
  saveCurrentFilters: string;
  save: string;
  savedViewToast: (name: string) => string;
  deleteView: (name: string) => string;
  viewTooLarge: string;
  columns: string;
  searchColumn: string;
  restoreDefault: string;
  reorderColumn: (title: string) => string;
  clearSearchToReorder: string;
  allRows: string;
  sortedBy: (title: string, desc: boolean) => string;
  exportLabel: string;
  exportCsv: string;
  exportXlsx: string;
  exporting: (pct: number) => string;
  nothingToExport: string;
  exportedPartial: (n: string, total: string) => string;
  exportedAll: (n: string) => string;
  exportFailed: string;
  fullscreen: string;
  exitFullscreen: string;
  undo: string;
  redo: string;
  find: string;
  findAria: string;
  density: string;
  densityLabels: Record<GridDensity, string>;
  // filter popover
  columnMenu: (title: string) => string;
  sortAsc: string;
  sortDesc: string;
  condition: string;
  value: string;
  from: string;
  to: string;
  minChars: (n: number) => string;
  searchValues: string;
  selectAll: string;
  showingCap: (cap: number) => string;
  apply: string;
  opLabels: Record<GridConditionOp, string>;
  freezeToHere: string;
  unfreeze: string;
  resizeHint: string;
  // status bar
  rows: (n: string) => string;
  showingFirst: (n: string) => string;
  total: string;
  avg: string;
  cells: (n: string) => string;
  partial: string;
  exact: string;
  computeExact: string;
  computeExactTitle: string;
  computeExactFailed: string;
  sum: string;
  mean: string;
  min: string;
  max: string;
  // empty / loading state
  emptyTitle: string;
  emptyHint: string;
  loading: string;
  // find bar
  findPlaceholder: string;
  findMatches: (pos: string, total: string, capped: boolean) => string;
  findNoMatches: (rows: string) => string;
  findPrev: string;
  findNext: string;
  findClose: string;
  // clipboard (data-grid)
  selectAllCorner: string;
  copy: string;
  nothingCopied: string;
  copiedPartial: (
    copied: string,
    total: string,
    skipped: boolean,
    truncated: boolean,
  ) => string;
  cellsCopied: (n: string) => string;
  copyFailed: string;
};

const EN: GridStrings = {
  filterCount: (n) => `${n} ${n === 1 ? "filter" : "filters"}`,
  clear: "Clear",
  savedViews: "Saved views",
  noSavedViews: "No saved views",
  saveCurrentFilters: "Save current filters",
  save: "Save",
  savedViewToast: (name) => `View "${name}" saved`,
  deleteView: (name) => `Delete view ${name}`,
  viewTooLarge:
    "Filter too large to save — reduce the filters or delete old saved views",
  columns: "Columns",
  searchColumn: "Search column…",
  restoreDefault: "Restore default",
  reorderColumn: (title) => `Reorder column ${title}`,
  clearSearchToReorder: "Clear the search to reorder",
  allRows: "All rows",
  sortedBy: (title, desc) => `Sorted by ${title} ${desc ? "↓" : "↑"}`,
  exportLabel: "Export",
  exportCsv: "CSV (.csv)",
  exportXlsx: "Excel (.xlsx)",
  exporting: (pct) => `Exporting… ${pct}%`,
  nothingToExport: "Nothing to export with the current filters",
  exportedPartial: (n, total) =>
    `Exported the first ${n} of ${total} rows — refine with filters`,
  exportedAll: (n) => `${n} rows exported`,
  exportFailed: "Export failed",
  fullscreen: "Fullscreen",
  exitFullscreen: "Exit fullscreen",
  undo: "Undo (Ctrl+Z)",
  redo: "Redo (Ctrl+Shift+Z)",
  find: "Find (Ctrl+F)",
  findAria: "Find in grid",
  density: "Row density",
  densityLabels: {
    compact: "Compact",
    default: "Default",
    comfortable: "Comfortable",
  },
  columnMenu: (title) => `Menu for column ${title}`,
  sortAsc: "Sort ascending",
  sortDesc: "Sort descending",
  condition: "Condition",
  value: "Value",
  from: "From",
  to: "To",
  minChars: (n) => `Enter at least ${n} characters.`,
  searchValues: "Search values…",
  selectAll: "(Select all)",
  showingCap: (cap) => `Showing ${cap} — type to refine.`,
  apply: "Apply",
  opLabels: {
    startsWith: "starts with",
    contains: "contains",
    eq: "equals",
    gte: "greater or equal",
    lte: "less or equal",
    between: "between",
  },
  freezeToHere: "Freeze up to this column",
  unfreeze: "Unfreeze columns",
  resizeHint: "Drag to resize · double-click fits the content",
  rows: (n) => `${n} rows`,
  showingFirst: (n) => ` · showing the first ${n} — refine with filters`,
  total: "total",
  avg: "avg",
  cells: (n) => `${n} cells`,
  partial: "partial:",
  exact: "exact:",
  computeExact: "compute exact",
  computeExactTitle: "Sum the whole selection on the server",
  computeExactFailed: "Could not compute the selection on the server",
  sum: "sum",
  mean: "avg",
  min: "min",
  max: "max",
  emptyTitle: "No rows found",
  emptyHint: "Adjust or clear filters to see results.",
  loading: "Loading…",
  findPlaceholder: "Find in the loaded rows",
  findMatches: (pos, total, capped) => `${pos} of ${total}${capped ? "+" : ""}`,
  findNoMatches: (rows) => `0 in ${rows} rows`,
  findPrev: "Previous (Shift+Enter)",
  findNext: "Next (Enter)",
  findClose: "Close find (Esc)",
  selectAllCorner: "Select all",
  copy: "Copy",
  nothingCopied: "Nothing copied — the selected rows haven't loaded yet.",
  copiedPartial: (copied, total, skipped, truncated) =>
    `Copied ${copied} of ${total} selected rows` +
    (skipped ? " — unloaded rows were skipped" : "") +
    (truncated ? " — per-copy cell limit reached" : ""),
  cellsCopied: (n) => `${n} cells copied`,
  copyFailed: "Could not copy to the clipboard",
};

const STRINGS: Record<GridLanguage, GridStrings> = { en: EN };

export function resolveGridStrings(lang: GridLanguage): GridStrings {
  return STRINGS[lang] ?? EN;
}
