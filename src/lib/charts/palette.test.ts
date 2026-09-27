import assert from "node:assert/strict";
import { test } from "node:test";

import { gwTick } from "./palette";

test("GW ticks keep one decimal only when they need it", () => {
  assert.equal(gwTick(0), "0 GW");
  assert.equal(gwTick(80_000), "80 GW");
  assert.equal(gwTick(3_500), "3.5 GW");
  assert.equal(gwTick(10_500), "10.5 GW");
});
