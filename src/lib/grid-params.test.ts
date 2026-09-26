import assert from "node:assert/strict";
import { test } from "node:test";

import type { GridColumn } from "@/components/data-grid";

import { buildGridParams, GRID_LIST_SEPARATOR } from "./grid-params";

type Row = { county: string; status: string; mw: number; filed: string; name: string };

const COLUMNS: GridColumn<Row>[] = [
  {
    id: "county",
    title: "County",
    type: "text",
    width: 140,
    filter: { optionsKey: "county", paramMap: { csv: "county" } },
  },
  {
    id: "name",
    title: "Name",
    type: "text",
    width: 200,
    filter: { conditions: "text", paramMap: { contains: "q", startsWith: "prefix" } },
  },
  {
    id: "mw",
    title: "MW",
    type: "number",
    width: 90,
    filter: { conditions: "number", paramMap: { range: { min: "mwMin", max: "mwMax" } } },
  },
  {
    id: "filed",
    title: "Filed",
    type: "date",
    width: 110,
    filter: { conditions: "date", paramMap: { range: { min: "from", max: "to" } } },
  },
  {
    id: "status",
    title: "Status",
    type: "text",
    width: 110,
    filter: { conditions: "text", paramMap: { equals: "status" } },
  },
];

/** The querystring as ordered pairs, decoded. */
const pairs = (qs: string) => [...new URLSearchParams(qs)];

test("no state serializes to an empty string", () => {
  assert.equal(buildGridParams(COLUMNS, {}, null), "");
});

test("sorting becomes sort + dir", () => {
  assert.equal(buildGridParams(COLUMNS, {}, { id: "mw", desc: true }), "dir=desc&sort=mw");
  assert.equal(buildGridParams(COLUMNS, {}, { id: "mw", desc: false }), "dir=asc&sort=mw");
});

test("checkbox values ride one param, sorted and joined by the unit separator", () => {
  const qs = buildGridParams(COLUMNS, { county: { values: ["Travis", "Bexar, TX"] } }, null);
  assert.deepEqual(pairs(qs), [["county", `Bexar, TX${GRID_LIST_SEPARATOR}Travis`]]);
});

test("each condition maps onto the column's paramMap", () => {
  const cases: [Parameters<typeof buildGridParams<Row>>[1], [string, string][]][] = [
    [{ name: { condition: { op: "contains", value: "solar" } } }, [["q", "solar"]]],
    [{ name: { condition: { op: "startsWith", value: "Sun" } } }, [["prefix", "Sun"]]],
    [{ mw: { condition: { op: "gte", value: "100" } } }, [["mwMin", "100"]]],
    [{ mw: { condition: { op: "lte", value: "250" } } }, [["mwMax", "250"]]],
    // `eq` without an `equals` param becomes a closed range.
    [{ mw: { condition: { op: "eq", value: "50" } } }, [["mwMax", "50"], ["mwMin", "50"]]],
    [{ status: { condition: { op: "eq", value: "Approved" } } }, [["status", "Approved"]]],
    [
      { filed: { condition: { op: "between", value: "2025-01-01", value2: "2025-12-31" } } },
      [["from", "2025-01-01"], ["to", "2025-12-31"]],
    ],
    // Between with one side only.
    [{ filed: { condition: { op: "between", value: "", value2: "2025-12-31" } } }, [["to", "2025-12-31"]]],
  ];
  for (const [filters, expected] of cases) {
    assert.deepEqual(pairs(buildGridParams(COLUMNS, filters, null)), expected, JSON.stringify(filters));
  }
});

test("a condition the paramMap cannot express is dropped, never guessed", () => {
  // `name` has no equals/range; `status` has no contains.
  assert.equal(buildGridParams(COLUMNS, { name: { condition: { op: "gte", value: "a" } } }, null), "");
  assert.equal(buildGridParams(COLUMNS, { status: { condition: { op: "contains", value: "app" } } }, null), "");
});

test("filters on unknown or unfilterable columns are ignored", () => {
  assert.equal(buildGridParams(COLUMNS, { ghost: { values: ["x"] } }, null), "");
});

test("output is stable: same state, same string, whatever the insertion order", () => {
  const a = buildGridParams(
    COLUMNS,
    {
      county: { values: ["Travis", "Hays"] },
      mw: { condition: { op: "gte", value: "10" } },
    },
    { id: "filed", desc: false },
    [["snapshot", "2026-09-01"]],
  );
  const b = buildGridParams(
    COLUMNS,
    {
      mw: { condition: { op: "gte", value: "10" } },
      county: { values: ["Hays", "Travis"] },
    },
    { id: "filed", desc: false },
    [["snapshot", "2026-09-01"]],
  );
  assert.equal(a, b);
  assert.deepEqual(
    pairs(a).map(([k]) => k),
    ["county", "dir", "mwMin", "snapshot", "sort"],
  );
});

test("values are URL-encoded", () => {
  const qs = buildGridParams(COLUMNS, { name: { condition: { op: "contains", value: "a&b=c ñ" } } }, null);
  assert.equal(qs, "q=a%26b%3Dc%20%C3%B1");
  assert.deepEqual(pairs(qs), [["q", "a&b=c ñ"]]);
});
