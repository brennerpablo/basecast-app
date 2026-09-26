import assert from "node:assert/strict";
import { test } from "node:test";

import { tabUrl } from "./tab-url";

test("swaps the tab parameter and keeps the rest of the query", () => {
  assert.equal(tabUrl("https://x.test/accounts?q=a&tab=summary", "tab", "triggers"), "/accounts?q=a&tab=triggers");
});

test("the default value leaves the URL, as the click does", () => {
  assert.equal(tabUrl("/accounts?tab=triggers&q=a", "tab", "summary", "summary"), "/accounts?q=a");
  assert.equal(tabUrl("/accounts?tab=triggers", "tab", "summary", "summary"), "/accounts");
});

test("drops origin and hash", () => {
  assert.equal(tabUrl("https://x.test/forecast#chart", "view", "p90"), "/forecast?view=p90");
});
