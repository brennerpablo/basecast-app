"use client";

import type { Virtualizer } from "@tanstack/react-virtual";
import * as React from "react";

import { scrollCellIntoView } from "./scroll-into-view";
import type { GridSelectionStore } from "./selection-store";
import type { CellCoord } from "./types";

/**
 * Sheets-style keyboard navigation. Arrows move the active cell, Shift
 * extends the range from the anchor, Ctrl/Cmd jumps to the data edge (the
 * dataset is fully dense, so the edge IS the first/last row/column —
 * matching Excel on a filled sheet). Ctrl/Cmd+C is handled by the caller via
 * `onCopy`, Ctrl/Cmd+F opens Find, and Ctrl/Cmd+Z / Ctrl+Shift+Z step
 * the VIEW history (filters, sort, column layout — there is no cell editing to
 * undo here; see use-grid-history.ts).
 *
 * Tab and Enter walk cells like a spreadsheet (Tab wraps to the next row,
 * Enter steps down; Shift reverses both) and always COLLAPSE the selection —
 * Shift is the direction modifier there, not the extend modifier. They only
 * do that while a selection exists: with none, Tab is left alone to move
 * focus out of the grid, which is the behavior the ARIA grid pattern expects
 * and the only way out of the sheet for a keyboard user. Escape clears the
 * selection, so "Escape then Tab" always leaves.
 */

type KeyboardDeps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  store: GridSelectionStore;
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  colOffsets: number[];
  rowCount: number;
  colCount: number;
  rowHeight: number;
  /** Leading columns frozen to the left edge (never scrolled to). */
  frozenCount: number;
  frozenWidth: number;
  onCopy: () => void;
  onFind: () => void;
  onUndo: () => void;
  onRedo: () => void;
};

export function useGridKeyboard({
  scrollRef,
  store,
  virtualizer,
  colOffsets,
  rowCount,
  colCount,
  rowHeight,
  frozenCount,
  frozenWidth,
  onCopy,
  onFind,
  onUndo,
  onRedo,
}: KeyboardDeps) {
  return React.useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      // The header's filter menus portal to `document.body` but stay React
      // children of this subtree, so their keystrokes bubble here through
      // React's synthetic event tree even though they live outside the grid's
      // DOM. Never hijack a key — above all Cmd/Ctrl+A, Cmd/Ctrl+C and the
      // arrows — that belongs to a focused form field or an open overlay.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target !== e.currentTarget &&
        (!e.currentTarget.contains(target) ||
          target.closest(
            'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="menu"], [role="listbox"], [role="combobox"]',
          ))
      ) {
        return;
      }
      if (rowCount === 0 || colCount === 0) return;
      const ctrl = e.metaKey || e.ctrlKey;
      const key = e.key;

      if (ctrl && (key === "c" || key === "C")) {
        e.preventDefault();
        onCopy();
        return;
      }
      if (ctrl && (key === "f" || key === "F")) {
        e.preventDefault();
        onFind();
        return;
      }
      if (ctrl && (key === "z" || key === "Z")) {
        e.preventDefault();
        // Shift+Z is Sheets' redo; Ctrl+Y is Excel's, and accepting both
        // costs one line.
        if (e.shiftKey) onRedo();
        else onUndo();
        return;
      }
      if (ctrl && (key === "y" || key === "Y")) {
        e.preventDefault();
        onRedo();
        return;
      }
      if (ctrl && (key === "a" || key === "A")) {
        e.preventDefault();
        store.selectAll();
        return;
      }
      if (key === "Escape") {
        // Precedence: a live selection is cleared first. When we consume the
        // Escape this way, stop it propagating to the window-level listener
        // so the same keypress doesn't also exit fullscreen. With no
        // selection, let it bubble — that listener handles fullscreen exit.
        if (store.getRect()) {
          store.clear();
          e.stopPropagation();
        }
        return;
      }

      const snap = store.getSnapshot();
      const cur: CellCoord = snap.focus ?? { row: 0, col: 0 };
      // Ctrl+Space / Shift+Space select the active cell's column / row, and
      // both together select the sheet — the same three shortcuts Excel and
      // Sheets bind. The anchor stays on the current cell so the active ring
      // doesn't jump to row 0 / column A.
      if (key === " " || key === "Spacebar") {
        if (ctrl && e.shiftKey) {
          e.preventDefault();
          store.selectAll();
          return;
        }
        if (ctrl) {
          e.preventDefault();
          store.beginDrag(cur, "col", false, false);
          return;
        }
        if (e.shiftKey) {
          e.preventDefault();
          store.beginDrag(cur, "row", false, false);
          return;
        }
        return;
      }

      const el = scrollRef.current;
      const visibleRows = el
        ? Math.max(1, Math.floor(el.clientHeight / rowHeight) - 1)
        : 20;

      let next: CellCoord | null = null;
      // Tab/Enter never extend; Shift only reverses their direction.
      let collapse = false;
      switch (key) {
        case "ArrowDown":
          next = { row: ctrl ? rowCount - 1 : cur.row + 1, col: cur.col };
          break;
        case "ArrowUp":
          next = { row: ctrl ? 0 : cur.row - 1, col: cur.col };
          break;
        case "ArrowRight":
          next = { row: cur.row, col: ctrl ? colCount - 1 : cur.col + 1 };
          break;
        case "ArrowLeft":
          next = { row: cur.row, col: ctrl ? 0 : cur.col - 1 };
          break;
        case "PageDown":
          next = { row: cur.row + visibleRows, col: cur.col };
          break;
        case "PageUp":
          next = { row: cur.row - visibleRows, col: cur.col };
          break;
        case "Home":
          next = ctrl ? { row: 0, col: 0 } : { row: cur.row, col: 0 };
          break;
        case "End":
          next = ctrl
            ? { row: rowCount - 1, col: colCount - 1 }
            : { row: cur.row, col: colCount - 1 };
          break;
        case "Tab": {
          if (!snap.focus) return;
          collapse = true;
          next = e.shiftKey
            ? cur.col > 0
              ? { row: cur.row, col: cur.col - 1 }
              : { row: cur.row - 1, col: colCount - 1 }
            : cur.col < colCount - 1
              ? { row: cur.row, col: cur.col + 1 }
              : { row: cur.row + 1, col: 0 };
          break;
        }
        case "Enter": {
          if (!snap.focus) return;
          collapse = true;
          next = { row: cur.row + (e.shiftKey ? -1 : 1), col: cur.col };
          break;
        }
        default:
          return;
      }

      e.preventDefault();
      const clamped: CellCoord = {
        row: Math.max(0, Math.min(next.row, rowCount - 1)),
        col: Math.max(0, Math.min(next.col, colCount - 1)),
      };
      if (e.shiftKey && !collapse) store.extendTo(clamped);
      else store.setActive(clamped);

      scrollCellIntoView({
        el,
        virtualizer,
        colOffsets,
        frozenWidth,
        frozenCount,
        coord: clamped,
      });
    },
    [
      scrollRef,
      store,
      virtualizer,
      colOffsets,
      rowCount,
      colCount,
      rowHeight,
      frozenCount,
      frozenWidth,
      onCopy,
      onFind,
      onUndo,
      onRedo,
    ],
  );
}
