import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultColumnState,
  sanitizeColumnState,
  spreadsheetColumnName,
} from "./column-state";
import { MAX_COL_WIDTH, MIN_COL_WIDTH } from "./constants";
import type { GridColumn } from "./types";

const col = (id: string, extra: Partial<GridColumn<unknown>> = {}): GridColumn<unknown> => ({
  id,
  title: id.toUpperCase(),
  type: "text",
  width: 100,
  ...extra,
});

const COLUMNS = [col("a"), col("b"), col("c"), col("open", { pinned: "right" })];

test("the default state is the base order, nothing hidden or frozen", () => {
  assert.deepEqual(defaultColumnState(COLUMNS), {
    order: ["a", "b", "c", "open"],
    hidden: [],
    widths: {},
    frozen: 0,
  });
});

test("a stale state drops unknown ids, dedupes and appends new columns", () => {
  const state = sanitizeColumnState(
    { order: ["c", "gone", "a", "c"], hidden: ["gone", "b"], widths: { gone: 200, a: 150 } },
    COLUMNS,
  );
  assert.deepEqual(state.order, ["c", "a", "b", "open"]);
  assert.deepEqual(state.hidden, ["b"]);
  assert.deepEqual(state.widths, { a: 150 });
});

test("widths are clamped and non-finite ones dropped", () => {
  const state = sanitizeColumnState(
    { order: [], hidden: [], widths: { a: 5, b: 10_000, c: Number.NaN } },
    COLUMNS,
  );
  assert.deepEqual(state.widths, { a: MIN_COL_WIDTH, b: MAX_COL_WIDTH });
});

test("hiding every column is undone", () => {
  const state = sanitizeColumnState(
    { order: ["a", "b", "c", "open"], hidden: ["a", "b", "c", "open"], widths: {} },
    COLUMNS,
  );
  assert.deepEqual(state.hidden, []);
});

test("the freeze keeps at least one visible scrollable column", () => {
  const base = { order: ["a", "b", "c", "open"], widths: {} };
  // Three scrollable columns (the pinned one does not count): at most 2.
  assert.equal(sanitizeColumnState({ ...base, hidden: [], frozen: 9 }, COLUMNS).frozen, 2);
  // One hidden: at most 1.
  assert.equal(sanitizeColumnState({ ...base, hidden: ["b"], frozen: 2 }, COLUMNS).frozen, 1);
  assert.equal(sanitizeColumnState({ ...base, hidden: [], frozen: -3 }, COLUMNS).frozen, 0);
  assert.equal(sanitizeColumnState({ ...base, hidden: [], frozen: 1.7 }, COLUMNS).frozen, 1);
});

test("spreadsheet column names follow A…Z, AA…ZZ, AAA", () => {
  const cases: [number, string][] = [
    [0, "A"],
    [1, "B"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [51, "AZ"],
    [52, "BA"],
    [701, "ZZ"],
    [702, "AAA"],
    [16_383, "XFD"], // Excel's last column
  ];
  for (const [index, name] of cases) assert.equal(spreadsheetColumnName(index), name, String(index));
  assert.throws(() => spreadsheetColumnName(-1), RangeError);
  assert.throws(() => spreadsheetColumnName(1.5), RangeError);
});
