import assert from "node:assert/strict";
import { test } from "node:test";

import {
  conditionFromDraft,
  conditionOps,
  containsTooShort,
  defaultConditionOp,
  dotGroupsDigits,
  stripGrouping,
} from "./filter-model";
import type { GridColumnFilterConfig } from "./types";

const TEXT: GridColumnFilterConfig = {
  conditions: "text",
  paramMap: { contains: "q", startsWith: "prefix" },
};
const NUMBER: GridColumnFilterConfig = {
  conditions: "number",
  paramMap: { range: { min: "min", max: "max" } },
};
const DATE: GridColumnFilterConfig = {
  conditions: "date",
  paramMap: { range: { min: "from", max: "to" } },
};

test("a column offers only the conditions its paramMap reaches", () => {
  assert.deepEqual(conditionOps(TEXT), ["startsWith", "contains"]);
  assert.deepEqual(conditionOps(NUMBER), ["eq", "gte", "lte", "between"]);
  assert.deepEqual(
    conditionOps({ conditions: "number", paramMap: { range: { min: "min" } } }),
    ["gte"],
  );
  assert.deepEqual(conditionOps({ conditions: "text", paramMap: { equals: "s" } }), ["eq"]);
  // No `conditions`: a checkbox-only column.
  assert.deepEqual(conditionOps({ optionsKey: "k", paramMap: { csv: "k" } }), []);
  assert.deepEqual(conditionOps(undefined), []);
});

test("a fresh draft opens on the first condition; a date on between", () => {
  assert.equal(defaultConditionOp(TEXT), "startsWith");
  assert.equal(defaultConditionOp(NUMBER), "eq");
  assert.equal(defaultConditionOp(DATE), "between");
  assert.equal(defaultConditionOp(undefined), "");
});

test("contains needs three characters", () => {
  assert.equal(containsTooShort("contains", "ab"), true);
  assert.equal(containsTooShort("contains", " ab "), true);
  assert.equal(containsTooShort("contains", "abc"), false);
  assert.equal(containsTooShort("contains", ""), false);
  assert.equal(containsTooShort("startsWith", "a"), false);
});

test("a draft that filters nothing produces no condition", () => {
  assert.equal(conditionFromDraft(TEXT, { op: "", value: "x", value2: "" }), null);
  assert.equal(conditionFromDraft(TEXT, { op: "contains", value: "  ", value2: "" }), null);
  assert.equal(conditionFromDraft(TEXT, { op: "contains", value: "ab", value2: "" }), null);
});

test("values are trimmed; between applies with either side", () => {
  assert.deepEqual(conditionFromDraft(TEXT, { op: "contains", value: " solar ", value2: "" }), {
    op: "contains",
    value: "solar",
  });
  assert.deepEqual(conditionFromDraft(DATE, { op: "between", value: "", value2: "2025-12-31" }), {
    op: "between",
    value: "",
    value2: "2025-12-31",
  });
  assert.deepEqual(conditionFromDraft(DATE, { op: "between", value: "2025-01-01", value2: "" }), {
    op: "between",
    value: "2025-01-01",
  });
  // value2 only rides on between.
  assert.deepEqual(conditionFromDraft(NUMBER, { op: "gte", value: "5", value2: "9" }), {
    op: "gte",
    value: "5",
  });
});

test("a grouping dot is stripped only where the locale groups with a dot", () => {
  assert.equal(dotGroupsDigits("en-US"), false);
  assert.equal(dotGroupsDigits("de-DE"), true);
  assert.equal(stripGrouping("150.000", true), "150000");
  assert.equal(stripGrouping("1.250.000", true), "1250000");
  // Not the grouped shape: a decimal stays a decimal.
  assert.equal(stripGrouping("1.25", true), "1.25");
  assert.equal(stripGrouping("0.5", true), "0.5");
  // In en-US "150.000" means 150.
  assert.equal(stripGrouping("150.000", false), "150.000");
});

test("only a numeric column loses the grouping dot", () => {
  assert.deepEqual(
    conditionFromDraft(NUMBER, { op: "gte", value: "150.000", value2: "" }, { dotGroups: true }),
    { op: "gte", value: "150000" },
  );
  assert.deepEqual(
    conditionFromDraft(NUMBER, { op: "gte", value: "150.000", value2: "" }),
    { op: "gte", value: "150.000" },
  );
  assert.deepEqual(
    conditionFromDraft(TEXT, { op: "startsWith", value: "150.000", value2: "" }, { dotGroups: true }),
    { op: "startsWith", value: "150.000" },
  );
});
