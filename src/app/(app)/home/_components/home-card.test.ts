/** The home screen's data date: the one most cards share, the latest on a tie, none without a date. */
import assert from "node:assert/strict";
import { test } from "node:test";

import { commonAsOf } from "./home-card";

test("the page's date is the one most cards share, the latest on a tie", () => {
  assert.equal(commonAsOf(["2026-09-20", "2026-09-24", "2026-09-20", null]), "2026-09-20");
  assert.equal(commonAsOf(["2026-09-20", "2026-09-24"]), "2026-09-24");
  assert.equal(commonAsOf(["2026-09-24", undefined, "2026-09-20"]), "2026-09-24");
});

test("no date when no card has one", () => {
  assert.equal(commonAsOf([]), null);
  assert.equal(commonAsOf([null, undefined]), null);
});
