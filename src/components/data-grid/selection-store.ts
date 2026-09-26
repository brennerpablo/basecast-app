"use client";

import * as React from "react";

import type { CellCoord, GridRect } from "./types";

/**
 * Selection state for the grid, held OUTSIDE React so a drag-select mutates
 * this store instead of re-rendering the virtualized body. The only React
 * subscribers are the selection overlay, the status bar and the header /
 * gutter highlight cells — each through `useGridSelection` with a narrow
 * selector, so a drag re-renders a handful of tiny components per frame.
 */

export type SelectionMode = "cell" | "row" | "col";

export type SelectionSnapshot = {
  /** Where the selection started (click / first cell). */
  anchor: CellCoord | null;
  /** The active cell — moves with the drag or the keyboard. */
  focus: CellCoord | null;
  mode: SelectionMode;
  dragging: boolean;
  copyFlash: { rect: GridRect; ts: number } | null;
};

const EMPTY: SelectionSnapshot = {
  anchor: null,
  focus: null,
  mode: "cell",
  dragging: false,
  copyFlash: null,
};

/**
 * The snapshot's anchor→focus span normalized into an inclusive rect,
 * expanded to full width/height for row/col/all modes. Pure — selectors use
 * it against a snapshot, the store's `getRect` against its current one.
 */
export function selectionRect(
  s: SelectionSnapshot,
  rowCount: number,
  colCount: number,
): GridRect | null {
  if (!s.anchor || !s.focus || rowCount <= 0 || colCount <= 0) return null;
  let r0 = Math.min(s.anchor.row, s.focus.row);
  let r1 = Math.max(s.anchor.row, s.focus.row);
  let c0 = Math.min(s.anchor.col, s.focus.col);
  let c1 = Math.max(s.anchor.col, s.focus.col);
  if (s.mode === "row") {
    c0 = 0;
    c1 = colCount - 1;
  }
  if (s.mode === "col") {
    r0 = 0;
    r1 = rowCount - 1;
  }
  return {
    r0: Math.max(0, Math.min(r0, rowCount - 1)),
    r1: Math.max(0, Math.min(r1, rowCount - 1)),
    c0: Math.max(0, Math.min(c0, colCount - 1)),
    c1: Math.max(0, Math.min(c1, colCount - 1)),
  };
}

export class GridSelectionStore {
  private snap: SelectionSnapshot = EMPTY;
  private listeners = new Set<() => void>();
  private rowCount = 0;
  private colCount = 0;

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SelectionSnapshot => this.snap;

  setDimensions(rowCount: number, colCount: number) {
    if (rowCount !== this.rowCount || colCount !== this.colCount) {
      this.rectCache = null;
    }
    this.rowCount = rowCount;
    this.colCount = colCount;
  }

  // ~70 selector subscribers (gutter + header cells) each derive a boolean
  // from the rect on every emit — cache one rect per snapshot instead of
  // allocating one per subscriber per drag frame.
  private rectCache: { snap: SelectionSnapshot; rect: GridRect | null } | null =
    null;

  getRect(): GridRect | null {
    if (this.rectCache?.snap === this.snap) return this.rectCache.rect;
    const rect = selectionRect(this.snap, this.rowCount, this.colCount);
    this.rectCache = { snap: this.snap, rect };
    return rect;
  }

  private emit(next: Partial<SelectionSnapshot>) {
    this.snap = { ...this.snap, ...next };
    this.listeners.forEach((fn) => fn());
  }

  private clamp(c: CellCoord): CellCoord {
    return {
      row: Math.max(0, Math.min(c.row, Math.max(0, this.rowCount - 1))),
      col: Math.max(0, Math.min(c.col, Math.max(0, this.colCount - 1))),
    };
  }

  /** Click / plain arrow move: collapse to a single active cell. */
  setActive(c: CellCoord) {
    const p = this.clamp(c);
    this.emit({ anchor: p, focus: p, mode: "cell", dragging: false });
  }

  /** Shift+click / shift+arrow: keep the anchor, move the focus. */
  extendTo(c: CellCoord) {
    const p = this.clamp(c);
    this.emit({ anchor: this.snap.anchor ?? p, focus: p });
  }

  /**
   * `dragging` is false for selections made without the mouse (Ctrl/Shift+Space
   * from the keyboard, or the re-selection after a column move): the status bar
   * suppresses its aggregates while a drag is live, so leaving the flag on
   * would park it on "…" until the next click.
   */
  beginDrag(
    c: CellCoord,
    mode: SelectionMode,
    extend: boolean,
    dragging = true,
  ) {
    const p = this.clamp(c);
    if (extend && this.snap.anchor) {
      this.emit({ focus: p, mode, dragging });
    } else {
      this.emit({ anchor: p, focus: p, mode, dragging });
    }
  }

  dragOver(c: CellCoord) {
    if (!this.snap.dragging) return;
    const p = this.clamp(c);
    const f = this.snap.focus;
    if (f && f.row === p.row && f.col === p.col) return;
    this.emit({ focus: p });
  }

  endDrag() {
    if (this.snap.dragging) this.emit({ dragging: false });
  }

  selectRow(row: number, extend: boolean, dragging = true) {
    this.beginDrag({ row, col: 0 }, "row", extend, dragging);
  }

  selectColumn(col: number, extend: boolean, dragging = true) {
    this.beginDrag({ row: 0, col }, "col", extend, dragging);
  }

  selectAll() {
    if (this.rowCount === 0 || this.colCount === 0) return;
    this.emit({
      anchor: { row: 0, col: 0 },
      focus: { row: this.rowCount - 1, col: this.colCount - 1 },
      mode: "cell",
      dragging: false,
    });
  }

  clear() {
    this.emit({ anchor: null, focus: null, mode: "cell", dragging: false });
  }

  flashCopy(rect: GridRect) {
    this.emit({ copyFlash: { rect, ts: Date.now() } });
  }
}

/**
 * Subscribe to a slice of the selection state. The selector runs against the
 * immutable snapshot; `isEqual` (default `Object.is`) suppresses re-renders
 * when the selected slice didn't change — how gutter/header cells subscribe
 * to a single boolean.
 */
export function useGridSelection<T>(
  store: GridSelectionStore,
  selector: (s: SelectionSnapshot) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cacheRef = React.useRef<{ snap: SelectionSnapshot; value: T } | null>(
    null,
  );

  // Recreated every render so it closes over the latest selector; the cache
  // keeps getSnapshot referentially stable between store changes (a
  // useSyncExternalStore requirement) and `isEqual` suppresses value churn.
  const getValue = () => {
    const snap = store.getSnapshot();
    const cache = cacheRef.current;
    if (cache && cache.snap === snap) return cache.value;
    const value = selector(snap);
    if (cache && isEqual(cache.value, value)) {
      cacheRef.current = { snap, value: cache.value };
      return cache.value;
    }
    cacheRef.current = { snap, value };
    return value;
  };

  return React.useSyncExternalStore(store.subscribe, getValue, getValue);
}
