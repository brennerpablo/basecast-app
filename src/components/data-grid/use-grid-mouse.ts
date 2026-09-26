"use client";

import * as React from "react";

import { linkTarget } from "@/lib/tabs/link-target";

import { GUTTER_WIDTH, HEADER_HEIGHT } from "./constants";
import type { GridSelectionStore } from "./selection-store";
import type { CellCoord } from "./types";

/**
 * Mouse layer: delegated mousedown on the scroll container (cells, gutter,
 * headers, corner) and a window-level drag loop. Drag coordinates are pure
 * arithmetic from scroll offsets + client position (no elementFromPoint), the
 * move handler is rAF-throttled, and near-edge auto-scroll runs on an
 * interval that keeps extending the selection while the pointer is parked.
 *
 * It also handles `contextmenu` — only the SELECTION, never the menu itself,
 * which belongs to the `ContextMenuTrigger` around the container.
 *
 * Two drag kinds share the loop:
 * - "select": anchor→focus range extension (cells, gutter rows, headers).
 * - "move": Sheets-style column move — pressing the header of an ALREADY
 *   selected column arms a move; crossing a 4px threshold starts it (the
 *   drop boundary is reported via `onColMoveTarget`), releasing commits via
 *   `onColMove`. Releasing before the threshold collapses the selection to
 *   that single column, exactly like Sheets.
 *
 * Listeners rebind when the deps change (new filter combo / column set) —
 * cheap, and never mid-drag in practice.
 */

type MouseDeps = {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  store: GridSelectionStore;
  colOffsets: number[];
  rowCount: number;
  colCount: number;
  rowHeight: number;
  /** Width of the sticky frozen-left lane, in canvas px (0 when none). */
  frozenWidth: number;
  /** Live drop boundary (0..colCount) during a column move; null = none. */
  onColMoveTarget: (boundary: number | null) => void;
  /** Commit a column move: visible index `from` → visible boundary `to`. */
  onColMove: (from: number, to: number) => void;
};

const EDGE_PX = 28;
const EDGE_INTERVAL_MS = 50;
const MOVE_THRESHOLD_PX = 4;

export function useGridMouse({
  scrollRef,
  store,
  colOffsets,
  rowCount,
  colCount,
  rowHeight,
  frozenWidth,
  onColMoveTarget,
  onColMove,
}: MouseDeps) {
  const edgeStepPx = rowHeight * 2;
  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let dragKind: "select" | "move" | null = null;
    // Armed on mousedown over a selected header; promoted to a "move" drag
    // after the threshold, or collapsed to a click on mouseup.
    let movePending: { from: number; startX: number } | null = null;
    let moveFrom = -1;
    let moveTarget = -1;
    let rafId = 0;
    let edgeTimer: ReturnType<typeof setInterval> | null = null;
    let lastClient = { x: 0, y: 0 };
    // Captured once per drag — getBoundingClientRect per mousemove would
    // force a layout flush on every pointer event; the container's viewport
    // rect doesn't move during a drag.
    let containerRect = { top: 0, left: 0, right: 0, bottom: 0 };
    // Mutable so the edge-scroll interval always reads the CURRENT direction
    // (capturing dy/dx at interval creation froze the scroll direction).
    const edgeDir = { dx: 0, dy: 0 };

    /**
     * Pointer x → canvas x. The frozen lane doesn't scroll, so a pointer over
     * it maps to its own width regardless of `scrollLeft`; past the lane, the
     * result is clamped to the lane's right edge so a pointer parked over the
     * lane during a drag can't extend the selection into columns hidden
     * underneath it.
     */
    const canvasX = (clientX: number): number => {
      const vx = clientX - containerRect.left - GUTTER_WIDTH;
      if (vx < frozenWidth) return Math.max(0, vx);
      return Math.max(frozenWidth, vx + el.scrollLeft);
    };

    const coordFromClient = (clientX: number, clientY: number): CellCoord => {
      const rect = containerRect;
      const y = clientY - rect.top + el.scrollTop - HEADER_HEIGHT;
      const x = canvasX(clientX);
      const row = Math.max(
        0,
        Math.min(Math.floor(y / rowHeight), Math.max(0, rowCount - 1)),
      );
      let col = Math.max(0, colCount - 1);
      if (x < 0) {
        col = 0;
      } else {
        for (let i = 0; i < colCount; i++) {
          if (x < colOffsets[i + 1]) {
            col = i;
            break;
          }
        }
      }
      return { row, col };
    };

    /** Nearest column boundary (0..colCount) for the move drop line. */
    const boundaryFromClient = (clientX: number): number => {
      const x = canvasX(clientX);
      for (let i = 0; i < colCount; i++) {
        const mid = (colOffsets[i] + colOffsets[i + 1]) / 2;
        if (x < mid) return i;
      }
      return colCount;
    };

    const updateFromLastClient = () => {
      if (dragKind === "select") {
        store.dragOver(coordFromClient(lastClient.x, lastClient.y));
      } else if (dragKind === "move") {
        const b = boundaryFromClient(lastClient.x);
        if (b !== moveTarget) {
          moveTarget = b;
          onColMoveTarget(b);
        }
      }
    };

    const stopEdgeScroll = () => {
      if (edgeTimer) {
        clearInterval(edgeTimer);
        edgeTimer = null;
      }
    };

    const maybeEdgeScroll = () => {
      const rect = containerRect;
      edgeDir.dy =
        dragKind === "move"
          ? 0 // a column move only ever needs horizontal auto-scroll
          : lastClient.y > rect.bottom - EDGE_PX
            ? 1
            : lastClient.y < rect.top + HEADER_HEIGHT + EDGE_PX
              ? -1
              : 0;
      edgeDir.dx =
        lastClient.x > rect.right - EDGE_PX
          ? 1
          : lastClient.x < rect.left + GUTTER_WIDTH + frozenWidth + EDGE_PX
            ? -1
            : 0;
      if (!edgeDir.dy && !edgeDir.dx) {
        stopEdgeScroll();
        return;
      }
      if (edgeTimer) return;
      edgeTimer = setInterval(() => {
        el.scrollTop += edgeDir.dy * edgeStepPx;
        el.scrollLeft += edgeDir.dx * edgeStepPx;
        updateFromLastClient();
      }, EDGE_INTERVAL_MS);
    };

    const onMove = (e: MouseEvent) => {
      lastClient = { x: e.clientX, y: e.clientY };
      if (movePending) {
        if (Math.abs(e.clientX - movePending.startX) <= MOVE_THRESHOLD_PX) {
          return;
        }
        dragKind = "move";
        moveFrom = movePending.from;
        movePending = null;
      }
      if (!dragKind) return;
      maybeEdgeScroll();
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        updateFromLastClient();
      });
    };

    const onUp = () => {
      if (!dragKind && !movePending) return;
      stopEdgeScroll();
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
      el.classList.remove("select-none");
      if (movePending) {
        // Sub-threshold press on a selected header = plain click: collapse
        // the selection to that single column (Sheets behavior).
        store.selectColumn(movePending.from, false);
        store.endDrag();
        movePending = null;
      } else if (dragKind === "move") {
        onColMoveTarget(null);
        if (moveTarget >= 0) onColMove(moveFrom, moveTarget);
        moveFrom = -1;
        moveTarget = -1;
      } else if (dragKind === "select") {
        store.endDrag();
      }
      dragKind = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    const beginWindowDrag = (kind: "select" | null) => {
      dragKind = kind;
      const r = el.getBoundingClientRect();
      containerRect = { top: r.top, left: r.left, right: r.right, bottom: r.bottom };
      el.classList.add("select-none");
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      // Resize handles own their drag (see grid-header/startResize).
      if (target.closest("[data-grid-resize]")) return;
      // Buttons inside headers (filter funnel) own their clicks.
      if (target.closest("button")) return;
      // Link/action cells own their click — let it fire instead of starting a
      // selection.
      if (target.closest("[data-grid-cell-action]")) return;

      const corner = target.closest("[data-grid-corner]");
      if (corner) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        store.selectAll();
        return;
      }

      const header = target.closest<HTMLElement>("[data-grid-header-col]");
      if (header) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        const col = Number(header.dataset.gridHeaderCol);
        const rect = store.getRect();
        const snap = store.getSnapshot();
        if (
          !e.shiftKey &&
          snap.mode === "col" &&
          rect &&
          col >= rect.c0 &&
          col <= rect.c1
        ) {
          // Pressing an already-selected column header: arm a move.
          movePending = { from: col, startX: e.clientX };
          beginWindowDrag(null);
        } else {
          store.selectColumn(col, e.shiftKey);
          beginWindowDrag("select");
        }
        return;
      }

      const gutter = target.closest<HTMLElement>("[data-grid-gutter]");
      if (gutter) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        store.selectRow(Number(gutter.dataset.gridGutter), e.shiftKey);
        beginWindowDrag("select");
        return;
      }

      const cell = target.closest<HTMLElement>("[data-grid-cell]");
      if (cell) {
        e.preventDefault();
        el.focus({ preventScroll: true });
        const coord = {
          row: Number(cell.dataset.r),
          col: Number(cell.dataset.c),
        };
        if (e.shiftKey) {
          store.extendTo(coord);
        } else {
          store.beginDrag(coord, "cell", false);
        }
        beginWindowDrag("select");
      }
    };

    /**
     * Right click: moves the selection to the target when it is OUTSIDE it,
     * and keeps it when it is inside — the spreadsheet rule, and the one that
     * prevents the ugly case of picking 400 rows, missing the click on a fifth
     * column and copying one cell.
     *
     * Only that. What OPENS the menu is Radix's `ContextMenuTrigger` around the
     * container; this listener is native and sits on the element itself, so it
     * runs before React's delegated handler and the selection is already right
     * when the menu mounts.
     */
    const onContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // An external link (or a new-tab one) or a button inside a cell keeps
      // the BROWSER menu: "open in new tab" and "copy link address" are what
      // one wants there, and our menu has neither for a URL outside the app.
      // `stopPropagation` keeps React's delegated handler — and so Radix —
      // from seeing the event. An APP link goes on to the grid's menu, which
      // carries the app's own link items (see `GridContextMenuContent`).
      if (
        target.closest("[data-grid-cell-action]") &&
        !linkTarget(target, window.location.origin)
      ) {
        e.stopPropagation();
        return;
      }
      el.focus({ preventScroll: true });
      const rect = store.getRect();
      const snap = store.getSnapshot();

      if (target.closest("[data-grid-corner]")) {
        store.selectAll();
        return;
      }

      const header = target.closest<HTMLElement>("[data-grid-header-col]");
      if (header) {
        const col = Number(header.dataset.gridHeaderCol);
        const inside =
          snap.mode === "col" && rect && col >= rect.c0 && col <= rect.c1;
        if (!inside) store.selectColumn(col, false, false);
        return;
      }

      const gutter = target.closest<HTMLElement>("[data-grid-gutter]");
      if (gutter) {
        const row = Number(gutter.dataset.gridGutter);
        const inside =
          snap.mode === "row" && rect && row >= rect.r0 && row <= rect.r1;
        if (!inside) store.selectRow(row, false, false);
        return;
      }

      const cell = target.closest<HTMLElement>("[data-grid-cell]");
      if (cell) {
        const coord = {
          row: Number(cell.dataset.r),
          col: Number(cell.dataset.c),
        };
        const inside =
          rect &&
          coord.row >= rect.r0 &&
          coord.row <= rect.r1 &&
          coord.col >= rect.c0 &&
          coord.col <= rect.c1;
        if (!inside) store.setActive(coord);
      }
    };

    el.addEventListener("mousedown", onMouseDown);
    el.addEventListener("contextmenu", onContextMenu);
    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      el.removeEventListener("contextmenu", onContextMenu);
      onUp();
    };
  }, [
    scrollRef,
    store,
    colOffsets,
    rowCount,
    colCount,
    edgeStepPx,
    rowHeight,
    frozenWidth,
    onColMoveTarget,
    onColMove,
  ]);
}
