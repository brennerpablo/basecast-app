import assert from "node:assert/strict";
import { test } from "node:test";

import { gate } from "./gate";

test("the root and /how-its-built are the landing pages", () => {
  assert.deepEqual(gate("/"), { kind: "rewrite", to: "/landing/product.html" });
  assert.deepEqual(gate("/how-its-built"), { kind: "rewrite", to: "/landing/internal.html" });
});

test("every app page is open", () => {
  for (const path of ["/home", "/accounts", "/accounts/30123", "/data/tables/etl_run", "/operations"]) {
    assert.deepEqual(gate(path), { kind: "next" }, path);
  }
});

test("the retired sign-in, account, admin and ops screens go to the home", () => {
  for (const path of ["/sign-in", "/account", "/admin/users", "/ops"]) {
    assert.deepEqual(gate(path), { kind: "redirect", to: "/home" }, path);
  }
});
