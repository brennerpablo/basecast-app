import type { Virtualizer } from "@tanstack/react-virtual";

import { GUTTER_WIDTH } from "./constants";
import type { CellCoord } from "./types";

/**
 * Bring a cell into view — vertically through the virtualizer, horizontally by
 * hand. Shared by keyboard navigation and Find so the two can't drift.
 *
 * The horizontal half has two things permanently parked over the scrollport's
 * left edge: the sticky row-number gutter and, when the user froze columns,
 * the frozen lane. A cell scrolled to `scrollLeft = its offset` would land
 * UNDER them and read as "the grid didn't move". A frozen cell needs no
 * horizontal scroll at all — it is always on screen.
 */
export function scrollCellIntoView(opts: {
  el: HTMLDivElement | null;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  colOffsets: number[];
  /** Width of the frozen-left lane in canvas px (0 when nothing is frozen). */
  frozenWidth: number;
  frozenCount: number;
  coord: CellCoord;
}) {
  const { el, virtualizer, colOffsets, frozenWidth, frozenCount, coord } = opts;
  virtualizer.scrollToIndex(coord.row, { align: "auto" });
  if (!el || coord.col < frozenCount) return;

  const left = colOffsets[coord.col];
  const right = colOffsets[coord.col + 1];
  // Everything below is in canvas coordinates; the visible band of the canvas
  // is [scrollLeft + frozenWidth, scrollLeft + clientWidth - GUTTER_WIDTH].
  const viewport = el.clientWidth - GUTTER_WIDTH;
  if (left - frozenWidth < el.scrollLeft) {
    el.scrollLeft = Math.max(0, left - frozenWidth);
  } else if (right > el.scrollLeft + viewport) {
    el.scrollLeft = right - viewport;
  }
}
