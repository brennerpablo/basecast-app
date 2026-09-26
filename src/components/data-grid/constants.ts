export const ROW_HEIGHT = 32;
export const HEADER_HEIGHT = 36;
export const GUTTER_WIDTH = 56;
export const OVERSCAN = 8;

/** Hard cap on cells per clipboard copy (rows × selected columns). */
export const COPY_CELL_CAP = 100_000;

/** Column resize clamp. */
export const MIN_COL_WIDTH = 60;
export const MAX_COL_WIDTH = 600;

/**
 * Row-height presets behind the toolbar's density control. `default` is
 * `ROW_HEIGHT`; the labels live in `i18n.ts`, keyed by these ids.
 */
export const DENSITIES = [
  { id: "compact", rowHeight: 24 },
  { id: "default", rowHeight: ROW_HEIGHT },
  { id: "comfortable", rowHeight: 44 },
] as const;

export type GridDensity = (typeof DENSITIES)[number]["id"];

// z-index ladder: rows sit at auto/0, the selection overlay above them, the
// frozen-left lane above the overlay (it is opaque and must cover the columns
// scrolling under it), the frozen half of the selection overlay above THAT,
// the sticky gutter above all of it, the sticky header above the gutter, the
// column-move drop line above the header, and the top-left corner (sticky on
// both axes) above everything.
export const Z_OVERLAY = 10;
export const Z_FROZEN = 14;
export const Z_FROZEN_OVERLAY = 16;
export const Z_GUTTER = 20;
export const Z_HEADER = 30;
export const Z_DROPLINE = 35;
export const Z_CORNER = 40;
