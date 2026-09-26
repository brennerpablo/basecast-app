import { COPY_CELL_CAP } from "./constants";
import type { GridColumn, GridRect } from "./types";

export type CopyResult = {
  rows: number;
  cells: number;
  /** Rows inside the rect whose block wasn't loaded — not copied. */
  skippedRows: number;
  /** Rows dropped because the selection exceeded COPY_CELL_CAP. */
  truncatedRows: number;
};

const escTsv = (s: string) => s.replace(/[\t\n\r]+/g, " ");

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The selection rect as `text/plain` TSV + `text/html` `<table>` — the dual
 * format Excel and Google Sheets both parse, keeping columns and types on
 * paste. Only loaded rows are included; unloaded ones are counted so the
 * caller can tell the user. Pure (no clipboard access), so it is testable.
 */
export function selectionToClipboard<TData>(opts: {
  rect: GridRect;
  columns: GridColumn<TData>[];
  getRow: (index: number) => TData | undefined;
}): CopyResult & { tsv: string; html: string } {
  const { rect, columns, getRow } = opts;
  const cols = columns.slice(rect.c0, rect.c1 + 1);
  const tsvLines: string[] = [];
  const htmlRows: string[] = [];
  let rows = 0;
  let skippedRows = 0;
  let truncatedRows = 0;

  for (let r = rect.r0; r <= rect.r1; r++) {
    if ((rows + 1) * cols.length > COPY_CELL_CAP) {
      truncatedRows = rect.r1 - r + 1;
      break;
    }
    const row = getRow(r);
    if (!row) {
      skippedRows++;
      continue;
    }
    const values = cols.map((c) => {
      const v = (row as Record<string, unknown>)[c.id];
      if (c.copyValue) return c.copyValue(v, row);
      return v == null ? "" : String(v);
    });
    tsvLines.push(values.map(escTsv).join("\t"));
    htmlRows.push(
      `<tr>${values.map((v) => `<td>${escHtml(v)}</td>`).join("")}</tr>`,
    );
    rows++;
  }

  return {
    rows,
    cells: rows * cols.length,
    skippedRows,
    truncatedRows,
    tsv: tsvLines.join("\n"),
    html: `<table>${htmlRows.join("")}</table>`,
  };
}

/** Copy the selection rect to the system clipboard (see `selectionToClipboard`). */
export async function copySelection<TData>(opts: {
  rect: GridRect;
  columns: GridColumn<TData>[];
  getRow: (index: number) => TData | undefined;
}): Promise<CopyResult> {
  const { tsv, html, ...result } = selectionToClipboard(opts);
  try {
    await navigator.clipboard.write([
      new ClipboardItem({
        "text/plain": new Blob([tsv], { type: "text/plain" }),
        "text/html": new Blob([html], { type: "text/html" }),
      }),
    ]);
  } catch {
    // Older Firefox lacks ClipboardItem; TSV alone still pastes into sheets.
    await navigator.clipboard.writeText(tsv);
  }
  return result;
}
