import { MAX_COL_WIDTH, MIN_COL_WIDTH } from "./constants";

/**
 * Double-click autosize for a column: the width that fits the widest text the
 * grid can currently SEE.
 *
 * "Can see" is the honest qualifier and the reason this is measured on the
 * client. Only a handful of row blocks are resident at any moment (see
 * `useGridWindowQuery`), so an exact fit over the whole filtered set would
 * mean asking the server for a max-length aggregate per column — a full scan
 * to save 12px. Excel autosizes to the visible sheet; here the visible sheet
 * is the loaded window, and re-running the gesture after scrolling refits to
 * what is on screen then.
 *
 * Measurement is `canvas.measureText` with the cell's OWN computed font, taken
 * from a live cell — a hardcoded "12px sans-serif" drifts the moment the theme
 * changes its font stack, and drifts silently (columns come out slightly too
 * narrow, i.e. truncated, which is exactly what the gesture exists to fix).
 */

/** px of chrome around a cell's text: `px-2` on both sides + the 1px border. */
const CELL_CHROME = 17;
/** The header also carries the sort arrow and the filter funnel. */
const HEADER_CHROME = CELL_CHROME + 34;

let cachedCtx: CanvasRenderingContext2D | null | undefined;

function measurer(): CanvasRenderingContext2D | null {
  if (cachedCtx === undefined) {
    try {
      cachedCtx = document.createElement("canvas").getContext("2d");
    } catch {
      // No canvas implementation (jsdom without the canvas package).
      cachedCtx = null;
    }
  }
  return cachedCtx;
}

/**
 * The CSS `font` shorthand of an element. `getComputedStyle().font` comes back
 * empty in Firefox, so recompose it from the longhands there.
 */
export function fontOf(el: Element): string {
  const s = getComputedStyle(el);
  if (s.font) return s.font;
  return `${s.fontStyle} ${s.fontWeight} ${s.fontSize}/${s.lineHeight} ${s.fontFamily}`;
}

/**
 * Width in px that fits `title` in the header plus every string in `texts` in
 * the body, clamped to the resize limits. Returns null when the browser gives
 * us no 2d context (no measurement is better than a wrong one).
 */
export function measureAutoWidth(opts: {
  title: string;
  texts: string[];
  cellFont: string;
  headerFont: string;
}): number | null {
  const ctx = measurer();
  if (!ctx) return null;

  ctx.font = opts.headerFont;
  let widest = ctx.measureText(opts.title).width + HEADER_CHROME;

  ctx.font = opts.cellFont;
  for (const text of opts.texts) {
    if (!text) continue;
    const w = ctx.measureText(text).width + CELL_CHROME;
    if (w > widest) widest = w;
  }

  return Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, Math.ceil(widest)));
}
