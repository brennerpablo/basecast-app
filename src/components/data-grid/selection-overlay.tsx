"use client";

import { GUTTER_WIDTH, Z_FROZEN_OVERLAY, Z_OVERLAY } from "./constants";
import { useGridContext } from "./grid-context";
import { type SelectionSnapshot, useGridSelection } from "./selection-store";
import type { GridRect } from "./types";

/**
 * Absolutely-positioned selection chrome, painted in the grid's own
 * coordinate space — the range fill, the active-cell ring and the copy
 * flash. Geometry is pure arithmetic (fixed row height + column prefix
 * sums), so a drag updates three divs and nothing else.
 *
 * With frozen columns the same rectangles are painted TWICE: once in the
 * canvas, where the frozen lane covers them (the lane must be opaque, or the
 * columns scrolling under it would show through), and once inside a sticky
 * clone that sits above the lane. Two layers and not one because the layers
 * have to straddle the lane in the z ladder — a single rectangle cannot be
 * below the lane on its scrolling half and above it on its frozen half.
 */
export function SelectionOverlay() {
  const { store, colOffsets, rowHeight, frozenCount, frozenWidth } =
    useGridContext();
  const snap = useGridSelection(store, (s) => s);
  const rect = store.getRect();

  if (!rect && !snap.copyFlash) return null;

  return (
    <>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ zIndex: Z_OVERLAY }}
      >
        <SelectionBoxes
          snap={snap}
          rect={rect}
          colOffsets={colOffsets}
          rowHeight={rowHeight}
          offsetX={GUTTER_WIDTH}
        />
      </div>
      {frozenCount > 0 && (
        <div
          aria-hidden
          className="pointer-events-none sticky h-full overflow-hidden"
          style={{
            zIndex: Z_FROZEN_OVERLAY,
            left: GUTTER_WIDTH,
            marginLeft: GUTTER_WIDTH,
            width: frozenWidth,
          }}
        >
          <SelectionBoxes
            snap={snap}
            rect={rect}
            colOffsets={colOffsets}
            rowHeight={rowHeight}
            offsetX={0}
          />
        </div>
      )}
    </>
  );
}

function SelectionBoxes({
  snap,
  rect,
  colOffsets,
  rowHeight,
  offsetX,
}: {
  snap: SelectionSnapshot;
  rect: GridRect | null;
  colOffsets: number[];
  rowHeight: number;
  offsetX: number;
}) {
  const box = (r: GridRect) => ({
    top: r.r0 * rowHeight,
    height: (r.r1 - r.r0 + 1) * rowHeight,
    left: offsetX + colOffsets[r.c0],
    width: colOffsets[r.c1 + 1] - colOffsets[r.c0],
  });

  return (
    <>
      {rect && (
        <div
          className="absolute border border-basecast-brand/70 bg-basecast-brand/10"
          style={box(rect)}
        />
      )}
      {snap.focus && rect && (
        <div
          className="absolute border-2 border-basecast-brand bg-transparent"
          style={box({
            r0: snap.focus.row,
            r1: snap.focus.row,
            c0: snap.focus.col,
            c1: snap.focus.col,
          })}
        />
      )}
      {snap.copyFlash && (
        // Keyed by the copy's timestamp so each copy restarts the fade.
        <div
          key={snap.copyFlash.ts}
          className="absolute animate-out border-2 border-basecast-brand bg-basecast-brand/25 duration-500 ease-out fade-out fill-mode-forwards"
          style={box(snap.copyFlash.rect)}
        />
      )}
    </>
  );
}
