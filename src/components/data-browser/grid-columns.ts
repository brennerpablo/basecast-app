import type { GridColumnType } from "@/components/data-grid";

import type { GridColumnInfo } from "./api";
import { formatCellText } from "./format";

export function gridType(column: GridColumnInfo): GridColumnType {
  return column.type === "number" ? "number" : column.type === "date" ? "date" : "text";
}

/** A default width from the column's name, kind and a sample value; the user can resize and autosize. */
export function columnWidth(column: GridColumnInfo, positional: boolean, sample?: unknown): number {
  if (positional) return 140;
  const text = sample === null || sample === undefined ? "" : formatCellText(sample);
  const chars = Math.max(column.name.length + 2, text.length);
  if (column.type === "number") return Math.min(200, Math.max(100, chars * 8 + 32));
  return Math.min(340, Math.max(110, chars * 7.5 + 32));
}
