import assert from "node:assert/strict";
import { test } from "node:test";

import { GridSelectionStore, selectionRect } from "./selection-store";

test("the rect is the normalized anchor→focus span", () => {
  const rect = selectionRect(
    { anchor: { row: 5, col: 3 }, focus: { row: 2, col: 1 }, mode: "cell", dragging: false, copyFlash: null },
    10,
    4,
  );
  assert.deepEqual(rect, { r0: 2, r1: 5, c0: 1, c1: 3 });
});

test("row and column modes span the whole sheet on the other axis", () => {
  const store = new GridSelectionStore();
  store.setDimensions(100, 6);
  store.selectRow(7, false, false);
  assert.deepEqual(store.getRect(), { r0: 7, r1: 7, c0: 0, c1: 5 });
  store.selectColumn(2, false, false);
  assert.deepEqual(store.getRect(), { r0: 0, r1: 99, c0: 2, c1: 2 });
  store.selectColumn(4, true, false);
  assert.deepEqual(store.getRect(), { r0: 0, r1: 99, c0: 2, c1: 4 });
});

test("coordinates are clamped to the sheet", () => {
  const store = new GridSelectionStore();
  store.setDimensions(10, 3);
  store.setActive({ row: 50, col: -2 });
  assert.deepEqual(store.getRect(), { r0: 9, r1: 9, c0: 0, c1: 0 });
});

test("a drag extends only while dragging", () => {
  const store = new GridSelectionStore();
  store.setDimensions(10, 5);
  store.beginDrag({ row: 1, col: 1 }, "cell", false);
  store.dragOver({ row: 3, col: 2 });
  assert.deepEqual(store.getRect(), { r0: 1, r1: 3, c0: 1, c1: 2 });
  store.endDrag();
  store.dragOver({ row: 8, col: 4 });
  assert.deepEqual(store.getRect(), { r0: 1, r1: 3, c0: 1, c1: 2 });
});

test("select all, clear, and an empty sheet has no selection", () => {
  const store = new GridSelectionStore();
  store.selectAll();
  assert.equal(store.getRect(), null);
  store.setDimensions(4, 2);
  store.selectAll();
  assert.deepEqual(store.getRect(), { r0: 0, r1: 3, c0: 0, c1: 1 });
  store.clear();
  assert.equal(store.getRect(), null);
});

test("subscribers hear every change; the rect is cached per snapshot", () => {
  const store = new GridSelectionStore();
  store.setDimensions(10, 5);
  let calls = 0;
  const off = store.subscribe(() => calls++);
  store.setActive({ row: 1, col: 1 });
  const a = store.getRect();
  assert.equal(store.getRect(), a);
  store.extendTo({ row: 2, col: 2 });
  assert.notEqual(store.getRect(), a);
  off();
  store.clear();
  assert.equal(calls, 2);
});
