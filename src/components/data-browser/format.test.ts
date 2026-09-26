import assert from "node:assert/strict";
import { test } from "node:test";

import { formatBytes, formatCellText, formatDateTime, formatDtRange, middleTruncate } from "./format";

test("formatBytes uses decimal units", () => {
  assert.equal(formatBytes(675108), "675 KB");
  assert.equal(formatBytes(3524858561), "3.52 GB");
  assert.equal(formatBytes(211_200_000), "211 MB");
  assert.equal(formatBytes(12), "12 B");
  assert.equal(formatBytes(null), "—");
});

test("formatDateTime shows Chicago time with its abbreviation", () => {
  assert.equal(formatDateTime("2026-09-26T05:07:59Z"), "Sep 26, 2026, 00:07 CDT");
  assert.equal(formatDateTime("2026-01-15T18:00:00Z"), "Jan 15, 2026, 12:00 CST");
  assert.equal(formatDateTime(null), "—");
});

test("formatDtRange", () => {
  assert.equal(formatDtRange("2014-05-01", "2026-08-01"), "2014-05 → 2026-08");
  assert.equal(formatDtRange("2026-09-26", "2026-09-26"), "2026-09-26");
});

test("middleTruncate keeps both ends", () => {
  const name = "RPT.00015933.0000000000000000.20260901.143805843.GIS_Report_August2026.xlsx";
  const short = middleTruncate(name, 40);
  assert.equal(short.length, 40);
  assert.ok(short.startsWith("RPT.0001"));
  assert.ok(short.endsWith("August2026.xlsx"));
});

test("formatCellText reads UTC timestamps", () => {
  assert.equal(formatCellText("2003-01-01T00:00:00+00:00"), "2003-01-01 00:00:00 UTC");
  assert.equal(formatCellText("2026-09-26T14:42:24.486717+00:00"), "2026-09-26 14:42:24 UTC");
  assert.equal(formatCellText("2026-09-26"), "2026-09-26");
  assert.equal(formatCellText(null), "");
  assert.equal(formatCellText(12.5), "12.5");
});
