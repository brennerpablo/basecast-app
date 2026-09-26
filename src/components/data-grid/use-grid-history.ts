"use client";

import * as React from "react";

import type { GridColumnState, GridFilterState, GridSortState } from "./types";

/**
 * Undo/redo of the VIEW — filters, sorting and column layout.
 *
 * A read-only sheet has no cell edit to undo, and that is why the stack holds
 * the view rather than the data: what a misclick destroys here is the setup of
 * the screen. Hiding eight columns, reordering, filtering by three values and
 * then hitting "Restore default" threw away a minute of work with no way back
 * — the undo button is the way back.
 *
 * **It records on the ACTION, not by observing props.** All three are
 * controlled by the screen, and observing them would have to guess who changed
 * them; worse, a screen that mirrors sorting into the URL commits it
 * separately from the rest, and an observer would record the intermediate
 * state as a step. Wrapping the three setters instead, every step is born from
 * a click inside the grid and carries the whole PREVIOUS state, coherent by
 * construction.
 *
 * A change from OUTSIDE the grid (the screen touching its own filters, the URL
 * changing) never enters the stack. That is the right behavior and not a gap:
 * "undo" here means "undo what I just did in this grid".
 */

/** Steps kept in each direction. */
const HISTORY_LIMIT = 50;

export type GridViewState = {
  filters: GridFilterState;
  sorting: GridSortState;
  columnState: GridColumnState;
};

type Deps = GridViewState & {
  onFiltersChange: (f: GridFilterState) => void;
  onSortingChange: (s: GridSortState) => void;
  onColumnStateChange: (c: GridColumnState) => void;
};

/**
 * Cheap equality to decide whether a click changed anything. Key order matters
 * to `JSON.stringify`, so a false "different" is possible — and it costs a
 * redundant step on the stack, never a lost one.
 */
const same = (a: unknown, b: unknown) =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

export function useGridHistory({
  filters,
  sorting,
  columnState,
  onFiltersChange,
  onSortingChange,
  onColumnStateChange,
}: Deps) {
  // The COMMITTED state, read by the wrappers during the event — when a
  // handler runs, the props are still the ones from before the change, which
  // is exactly what the step needs to keep.
  const currentRef = React.useRef<GridViewState>({
    filters,
    sorting,
    columnState,
  });
  React.useEffect(() => {
    currentRef.current = { filters, sorting, columnState };
  }, [filters, sorting, columnState]);

  const [past, setPast] = React.useState<GridViewState[]>([]);
  const [future, setFuture] = React.useState<GridViewState[]>([]);

  // One click can touch more than one of the three — applying a saved view
  // touches all three. The microtask collapses everything that happens in the
  // same event into one step; without it, undoing a saved view would undo a
  // third of it.
  const batchRef = React.useRef(false);
  const record = React.useCallback(() => {
    if (batchRef.current) return;
    batchRef.current = true;
    const snapshot = currentRef.current;
    queueMicrotask(() => {
      batchRef.current = false;
      setPast((p) => [...p, snapshot].slice(-HISTORY_LIMIT));
      setFuture([]);
    });
  }, []);

  /**
   * Applies a view by calling the RAW setters. That is what removes the need
   * for any "I am undoing" flag: the undo/redo path simply does not go through
   * the wrappers that record.
   */
  const apply = React.useCallback(
    (target: GridViewState) => {
      onFiltersChange(target.filters);
      onSortingChange(target.sorting);
      onColumnStateChange(target.columnState);
    },
    [onFiltersChange, onSortingChange, onColumnStateChange],
  );

  const undo = React.useCallback(() => {
    const target = past[past.length - 1];
    if (!target) return;
    const current = currentRef.current;
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [current, ...f].slice(0, HISTORY_LIMIT));
    apply(target);
  }, [past, apply]);

  const redo = React.useCallback(() => {
    const target = future[0];
    if (!target) return;
    const current = currentRef.current;
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, current].slice(-HISTORY_LIMIT));
    apply(target);
  }, [future, apply]);

  const wrappedFilters = React.useCallback(
    (f: GridFilterState) => {
      if (!same(f, currentRef.current.filters)) record();
      onFiltersChange(f);
    },
    [record, onFiltersChange],
  );

  const wrappedSorting = React.useCallback(
    (s: GridSortState) => {
      if (!same(s, currentRef.current.sorting)) record();
      onSortingChange(s);
    },
    [record, onSortingChange],
  );

  const wrappedColumnState = React.useCallback(
    (c: GridColumnState) => {
      if (!same(c, currentRef.current.columnState)) record();
      onColumnStateChange(c);
    },
    [record, onColumnStateChange],
  );

  return {
    onFiltersChange: wrappedFilters,
    onSortingChange: wrappedSorting,
    onColumnStateChange: wrappedColumnState,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  };
}
