"use client";

import { Loader2, Sigma } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { useGridContext } from "./grid-context";
import { intFormat, numFormat } from "./i18n";
import { useGridSelection } from "./selection-store";
import type { GridAggregate } from "./types";

/**
 * Excel-style status bar: filtered total on the left, selection stats on the
 * right (count always; sum/avg/min/max when the selection covers numeric
 * columns). Aggregates iterate loaded rows only — when the selection spans
 * unloaded blocks the stats are explicitly labeled "partial" — and are skipped
 * mid-drag (the bar shows "…" until the mouse releases).
 *
 * "Partial" is an offer, not just a disclaimer: with a `selectionStats` fetcher
 * wired, the label carries a button that asks the server for the aggregate
 * over the WHOLE selected range. That is one deliberate query per click and
 * never an automatic one — the numbers move with every drag, and recomputing
 * them server-side on each mouse-up would run a windowed aggregate dozens of
 * times a minute for a figure nobody asked for yet.
 */

/**
 * The dataset-wide figures the server returns with block 0 (`withSummary=1`).
 * Every field is optional: a plain `{ count }` summary is valid and shows
 * nothing extra.
 */
export type GridStatusSummary = {
  count?: number;
  /** Aggregate total for the summary column, or null. */
  total?: number | null;
  /** Aggregate mean for the summary column, or null. */
  mean?: number | null;
};

type Stats = {
  sum: number;
  min: number;
  max: number;
  n: number;
  /** True when part of the selection wasn't loaded (stats are partial). */
  partial: boolean;
} | null;

/** Exact (server-side) aggregate for one selection rect. */
type ExactState = {
  /** Rect signature this belongs to; a stale one is ignored. */
  key: string;
  loading: boolean;
  value: { sum: number; min: number; max: number; n: number } | null;
};

export function GridStatusBar({
  totalCount,
  rowCount,
  getRow,
  summary,
  isFetching,
  selectionStats,
}: {
  totalCount: number;
  rowCount: number;
  getRow: (index: number) => unknown;
  summary?: GridStatusSummary | null;
  isFetching?: boolean;
  selectionStats?: (req: {
    r0: number;
    r1: number;
    columnIds: string[];
  }) => Promise<Record<string, GridAggregate>>;
}) {
  const { store, columns, strings, language } = useGridContext();
  const intFmt = intFormat(language);
  const numFmt = numFormat(language);
  // Narrow subscription: primitive rect bounds + drag flag, so an emit that
  // doesn't move the selection doesn't re-render the bar.
  const sel = useGridSelection(
    store,
    () => {
      const rect = store.getRect();
      const dragging = store.getSnapshot().dragging;
      return rect
        ? ([rect.r0, rect.r1, rect.c0, rect.c1, dragging] as const)
        : null;
    },
    (a, b) =>
      a === b ||
      (!!a && !!b && a.length === b.length && a.every((v, i) => v === b[i])),
  );
  const [r0, r1, c0, c1, dragging] = sel ?? [0, -1, 0, -1, false];

  const stats = React.useMemo<Stats>(() => {
    if (r1 < r0 || dragging) return null;
    const numericCols: string[] = [];
    for (let c = c0; c <= c1; c++) {
      if (columns[c]?.type === "number") numericCols.push(columns[c].id);
    }
    if (!numericCols.length) return null;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let n = 0;
    let loadedRows = 0;
    for (let r = r0; r <= r1; r++) {
      const row = getRow(r) as Record<string, unknown> | undefined;
      if (!row) continue;
      loadedRows++;
      for (const id of numericCols) {
        const v = row[id];
        if (typeof v !== "number" || !Number.isFinite(v)) continue;
        sum += v;
        if (v < min) min = v;
        if (v > max) max = v;
        n++;
      }
    }
    return n
      ? { sum, min, max, n, partial: loadedRows < r1 - r0 + 1 }
      : null;
  }, [r0, r1, c0, c1, dragging, columns, getRow]);

  const cellCount = r1 >= r0 ? (r1 - r0 + 1) * (c1 - c0 + 1) : 0;

  // Keyed by the rect: moving the selection invalidates a previous answer
  // without needing an effect to clear it.
  const rectKey = `${r0}:${r1}:${c0}:${c1}`;
  const [exact, setExact] = React.useState<ExactState | null>(null);
  const shown = exact?.key === rectKey ? exact : null;

  // The exact answer replaces the local one wherever it exists; the label
  // says which of the two is on screen, and never leaves that implicit.
  const display = shown?.value ?? stats;
  const displayLabel = shown?.value
    ? `${strings.exact} `
    : stats?.partial
      ? `${strings.partial} `
      : "";

  const askServer = React.useCallback(async () => {
    if (!selectionStats) return;
    const columnIds: string[] = [];
    for (let c = c0; c <= c1; c++) {
      if (columns[c]?.type === "number") columnIds.push(columns[c].id);
    }
    if (!columnIds.length) return;
    setExact({ key: rectKey, loading: true, value: null });
    try {
      const byField = await selectionStats({ r0, r1, columnIds });
      let sum = 0;
      let min = Infinity;
      let max = -Infinity;
      let n = 0;
      for (const id of columnIds) {
        const agg = byField[id];
        if (!agg?.count) continue;
        sum += agg.sum ?? 0;
        if (agg.min != null && agg.min < min) min = agg.min;
        if (agg.max != null && agg.max > max) max = agg.max;
        n += agg.count;
      }
      setExact({
        key: rectKey,
        loading: false,
        value: n ? { sum, min, max, n } : null,
      });
    } catch {
      setExact(null);
      toast.error(strings.computeExactFailed);
    }
  }, [selectionStats, columns, c0, c1, r0, r1, rectKey, strings]);

  return (
    <div className="flex h-8 shrink-0 items-center gap-3 border-t bg-muted/50 px-3 text-xs text-muted-foreground">
      <span>
        {strings.rows(intFmt.format(totalCount))}
        {rowCount > 0 && rowCount < totalCount &&
          strings.showingFirst(intFmt.format(rowCount))}
      </span>
      {summary?.total != null && (
        <span className="hidden md:inline">
          {strings.total} {numFmt.format(summary.total)}
          {summary.mean != null && (
            <>
              {" "}
              · {strings.avg} {numFmt.format(summary.mean)}
            </>
          )}
        </span>
      )}
      {isFetching && <Loader2 className="size-3.5 animate-spin" />}
      <span className="ml-auto tabular-nums">
        {cellCount > 0 && (
          <>
            {strings.cells(intFmt.format(cellCount))}
            {dragging && " · …"}
            {display && (
              <>
                {" "}
                · {displayLabel}
                {strings.sum} {numFmt.format(display.sum)} · {strings.mean}{" "}
                {numFmt.format(display.sum / display.n)} · {strings.min}{" "}
                {numFmt.format(display.min)} · {strings.max}{" "}
                {numFmt.format(display.max)}
              </>
            )}
            {stats?.partial && !shown?.value && selectionStats && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-1.5 h-5 px-1.5 text-[11px]"
                disabled={shown?.loading}
                onClick={askServer}
                title={strings.computeExactTitle}
              >
                {shown?.loading ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Sigma className="size-3" />
                )}
                {strings.computeExact}
              </Button>
            )}
          </>
        )}
      </span>
    </div>
  );
}
