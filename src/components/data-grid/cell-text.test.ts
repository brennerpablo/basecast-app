import assert from "node:assert/strict";
import { test } from "node:test";

import { cellAlign, cellText, matchRange } from "./cell-text";
import { selectionToClipboard } from "./clipboard";
import { foldIncludes, foldText } from "./fold-text";
import type { GridColumn } from "./types";

type Row = { name: string; mw: number | null; id: string };

const NAME: GridColumn<Row> = { id: "name", title: "Name", type: "text", width: 100 };
const MW: GridColumn<Row> = {
  id: "mw",
  title: "MW",
  type: "number",
  width: 80,
  format: (v) => (typeof v === "number" ? v.toLocaleString("en-US") : "—"),
};
const ROW: Row = { name: "Ñandú Solar", mw: 1250000, id: "x1" };

test("folding drops case and accents", () => {
  assert.equal(foldText("Ñandú SOLAR"), "nandu solar");
  assert.equal(foldIncludes("São Paulo", "sao"), true);
  assert.equal(foldIncludes("anything", ""), true);
  assert.equal(foldIncludes("Austin", "dallas"), false);
});

test("cell text is what the eye reads: formatted, blank for null", () => {
  assert.equal(cellText(NAME, ROW), "Ñandú Solar");
  assert.equal(cellText(MW, ROW), "1,250,000");
  assert.equal(cellText(MW, { ...ROW, mw: null }), "—");
  assert.equal(cellText(NAME, { ...ROW, name: null as unknown as string }), "");
  assert.equal(cellText(NAME, undefined), "");
});

test("a text link shows its text; an icon or custom action shows none", () => {
  const textLink: GridColumn<Row> = { ...NAME, action: { href: (r) => `/data/${r.id}` } };
  const iconLink: GridColumn<Row> = {
    ...NAME,
    action: { icon: () => null, label: "Open", href: (r) => `/data/${r.id}` },
  };
  const custom: GridColumn<Row> = { ...NAME, action: { render: () => "menu" } };
  assert.equal(cellText(textLink, ROW), "Ñandú Solar");
  assert.equal(cellText(iconLink, ROW), "");
  assert.equal(cellText(custom, ROW), "");
});

test("positional rows (arrays) read by index id", () => {
  const colB: GridColumn<unknown[]> = { id: "1", title: "B", type: "text", width: 80 };
  assert.equal(cellText(colB, ["a", "b", "c"]), "b");
});

test("numbers align right unless told otherwise", () => {
  assert.equal(cellAlign(MW), "right");
  assert.equal(cellAlign(NAME), "left");
  assert.equal(cellAlign({ ...MW, align: "left" }), "left");
});

test("the find highlight points into the original text", () => {
  assert.deepEqual(matchRange("Ñandú Solar", "ndu"), [2, 5]);
  assert.equal(matchRange("Ñandú Solar", ""), null);
  assert.equal(matchRange("Austin", "dallas"), null);
  // Already-decomposed text would slide the offsets: no highlight instead.
  assert.equal(matchRange("Nandú", "ndu"), null);
});

test("the clipboard payload is TSV + an HTML table of the loaded rows", () => {
  const rows: (Row | undefined)[] = [
    { name: "A\tB", mw: 1, id: "1" },
    undefined, // block not loaded
    { name: "<C>", mw: 3, id: "3" },
  ];
  const out = selectionToClipboard({
    rect: { r0: 0, r1: 2, c0: 0, c1: 1 },
    columns: [NAME, { ...MW, copyValue: (v) => String(v) }],
    getRow: (i) => rows[i],
  });
  assert.equal(out.rows, 2);
  assert.equal(out.cells, 4);
  assert.equal(out.skippedRows, 1);
  assert.equal(out.truncatedRows, 0);
  assert.equal(out.tsv, "A B\t1\n<C>\t3");
  assert.equal(out.html, "<table><tr><td>A\tB</td><td>1</td></tr><tr><td>&lt;C&gt;</td><td>3</td></tr></table>");
});
