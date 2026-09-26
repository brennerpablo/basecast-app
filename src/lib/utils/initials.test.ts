import assert from "node:assert/strict";
import { test } from "node:test";

import { getInitials } from "./initials";

test("first and last words' initials, uppercased", () => {
  assert.equal(getInitials("Pablo Brenner"), "PB");
  assert.equal(getInitials("ada  king lovelace"), "AL");
});

test("a single word gives its first two letters", () => {
  assert.equal(getInitials("pbrenner"), "PB");
  assert.equal(getInitials("A"), "A");
});

test("nothing to show gives '?'", () => {
  assert.equal(getInitials(""), "?");
  assert.equal(getInitials("   "), "?");
  assert.equal(getInitials(null), "?");
  assert.equal(getInitials(undefined), "?");
});
