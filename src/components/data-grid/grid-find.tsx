"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { cellText } from "./cell-text";
import { foldText } from "./fold-text";
import { useGridContext } from "./grid-context";
import { intFormat } from "./i18n";
import type { CellCoord, GridColumn } from "./types";

/**
 * Find (Ctrl/Cmd+F) — Sheets' find box over the rows the grid HOLDS.
 *
 * The scope is the honest part and it is stated in the UI, not buried here:
 * only a handful of blocks are resident at any moment (see
 * `useGridWindowQuery`), so this searches the loaded window, not the whole
 * filtered set behind it. A server-side find would have to answer "which
 * ORDINAL positions in this sort match?" — an `ORDER BY … OFFSET` scan of the
 * entire result per keystroke, which is the query the windowed grid exists to
 * avoid. The column filters are the tool for reaching a row that isn't loaded;
 * this is the tool for finding one that is, which is the case every time
 * someone lands here from the eye rather than from a predicate.
 *
 * Matching folds accents and case on both sides (`foldText`), so "nandu" finds
 * "Ñandú" — source data is inconsistently accented and a literal `includes`
 * would answer differently per dataset.
 */

/** Stop scanning after this many hits — navigation past it is meaningless. */
const MATCH_CAP = 2_000;
/** Keystroke settle time before the (synchronous) scan runs. */
const DEBOUNCE_MS = 200;
/**
 * Shortest needle worth scanning. The scan is synchronous over every resident
 * row × column and re-runs on each block load, so a single character — which
 * matches most cells anyway — would put that work on the scroll path for a
 * result nobody can use.
 */
const MIN_CHARS = 2;

export function GridFindBar<TData>({
  columns,
  rowCount,
  getRow,
  onNeedleChange,
  onGo,
  onClose,
}: {
  /** Visible, scrollable columns — the same set the eye sees. */
  columns: GridColumn<TData>[];
  rowCount: number;
  getRow: (index: number) => TData | undefined;
  /** Folded needle for the body's highlighting; "" clears it. */
  onNeedleChange: (needle: string) => void;
  /** Select + scroll to a match. */
  onGo: (coord: CellCoord) => void;
  onClose: () => void;
}) {
  const { strings, language } = useGridContext();
  const intFmt = intFormat(language);
  const [term, setTerm] = React.useState("");
  const [needle, setNeedle] = React.useState("");

  // The body learns the needle in the same tick the bar does — from the
  // settle itself, not from an effect one render later. An Effect Event, so a
  // new callback identity from the parent does not restart the debounce.
  const notifyNeedle = React.useEffectEvent(onNeedleChange);
  React.useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = term.trim();
      const next = trimmed.length >= MIN_CHARS ? foldText(trimmed) : "";
      setNeedle(next);
      notifyNeedle(next);
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  // Unmounting the bar must not leave the body painting highlights.
  React.useEffect(() => () => onNeedleChange(""), [onNeedleChange]);

  const { matches, loadedRows } = React.useMemo(() => {
    const found: CellCoord[] = [];
    let loaded = 0;
    if (!needle) return { matches: found, loadedRows: 0 };
    for (let r = 0; r < rowCount; r++) {
      const row = getRow(r);
      if (!row) continue;
      loaded++;
      for (let c = 0; c < columns.length; c++) {
        const text = cellText(columns[c], row);
        if (text && foldText(text).includes(needle)) {
          found.push({ row: r, col: c });
        }
      }
      if (found.length >= MATCH_CAP) break;
    }
    return { matches: found, loadedRows: loaded };
  }, [needle, rowCount, columns, getRow]);

  // A new needle starts at hit #1. Adjusted during RENDER, not in an effect,
  // so no frame shows the old position against the new count. Converges: the
  // comparison is true once per needle change.
  const [pos, setPos] = React.useState(0);
  const [posNeedle, setPosNeedle] = React.useState(needle);
  if (posNeedle !== needle) {
    setPosNeedle(needle);
    setPos(0);
  }

  // Jump to the first hit as the needle settles — and ONLY then. `matches` is
  // recomputed on every block load too, and re-running this on one would yank
  // the view back to hit #1 while the user is stepping through the list, so
  // the guard is the needle, not the identity of the match array.
  const lastNeedle = React.useRef("");
  React.useEffect(() => {
    if (lastNeedle.current === needle) return;
    lastNeedle.current = needle;
    if (matches[0]) onGo(matches[0]);
  }, [needle, matches, onGo]);

  const step = React.useCallback(
    (delta: number) => {
      if (!matches.length) return;
      const next = (pos + delta + matches.length) % matches.length;
      setPos(next);
      onGo(matches[next]);
    },
    [matches, pos, onGo],
  );

  return (
    <div className="absolute top-2 right-2 z-50 flex items-center gap-1 rounded-md border bg-background p-1 shadow-md">
      <Search className="ml-1 size-3.5 shrink-0 text-muted-foreground" />
      <Input
        autoFocus
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        placeholder={strings.findPlaceholder}
        aria-label={strings.findAria}
        className="h-7 w-56 border-0 text-xs shadow-none focus-visible:ring-0"
      />
      <span className="w-28 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
        {needle
          ? matches.length
            ? strings.findMatches(
                intFmt.format(pos + 1),
                intFmt.format(matches.length),
                matches.length >= MATCH_CAP,
              )
            : strings.findNoMatches(intFmt.format(loadedRows))
          : ""}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="size-7 p-0"
        disabled={!matches.length}
        onClick={() => step(-1)}
        title={strings.findPrev}
        aria-label={strings.findPrev}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="size-7 p-0"
        disabled={!matches.length}
        onClick={() => step(1)}
        title={strings.findNext}
        aria-label={strings.findNext}
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="size-7 p-0"
        onClick={onClose}
        title={strings.findClose}
        aria-label={strings.findClose}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
