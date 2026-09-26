import type { GridColumn } from "./types";

/**
 * Export a materialized row set (fetched by the caller — the grid only holds
 * ~viewport blocks) to CSV or XLSX. Values are RAW, not `format`-ed: numbers
 * stay numeric and dates stay ISO so a spreadsheet can sum/sort them. Headers
 * are the column titles.
 *
 * papaparse and xlsx are imported on demand: they are only needed at the
 * moment someone exports, and xlsx alone is several hundred KB that no grid
 * should pay for on first paint.
 */

const stamp = () => new Date().toISOString().slice(0, 10);

function rawValue<TData>(col: GridColumn<TData>, row: TData): unknown {
  const v = (row as Record<string, unknown>)[col.id];
  // copyValue exists to shape the clipboard/export value (e.g. drop a display
  // label); when present it wins, otherwise the raw cell value is used.
  return col.copyValue ? col.copyValue(v, row) : (v ?? "");
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportRowsToCSV<TData>(
  rows: TData[],
  columns: GridColumn<TData>[],
  filename: string,
): Promise<void> {
  const { default: Papa } = await import("papaparse");
  // Array of arrays, not objects keyed by title: two columns may share a
  // title (positional sheets, joined sources), and object keys would merge
  // them into one.
  const csv = Papa.unparse({
    fields: columns.map((col) => col.title),
    data: rows.map((row) => columns.map((col) => rawValue(col, row))),
  });
  // Leading BOM (U+FEFF): without it, Excel decodes the file in the system's
  // legacy code page and mangles every non-ASCII character.
  const blob = new Blob(["﻿" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(blob, `${filename}-${stamp()}.csv`);
}

export async function exportRowsToXLSX<TData>(
  rows: TData[],
  columns: GridColumn<TData>[],
  filename: string,
): Promise<void> {
  const XLSX = await import("xlsx");
  const header = columns.map((col) => col.title);
  const body = rows.map((row) => columns.map((col) => rawValue(col, row)));
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}-${stamp()}.xlsx`);
}
