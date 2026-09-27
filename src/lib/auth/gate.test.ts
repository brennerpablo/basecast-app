import assert from "node:assert/strict";
import { test } from "node:test";

import { gate } from "./gate";

test("a visitor at the root sees the product landing page", () => {
  assert.deepEqual(gate("/", "", false), { kind: "rewrite", to: "/landing/product.html" });
});

test("a signed-in user at the root goes to the app", () => {
  assert.deepEqual(gate("/", "", true), { kind: "redirect", to: "/home" });
});

test("the engineering landing page is open to everyone", () => {
  for (const signedIn of [false, true]) {
    assert.deepEqual(gate("/how-its-built", "", signedIn), {
      kind: "rewrite",
      to: "/landing/internal.html",
    });
  }
});

test("sign-in is open to visitors and sends users to the app", () => {
  assert.deepEqual(gate("/sign-in", "", false), { kind: "next" });
  assert.deepEqual(gate("/sign-in", "", true), { kind: "redirect", to: "/home" });
});

test("app pages need a session and keep where the visitor was going", () => {
  assert.deepEqual(gate("/accounts", "?rank=within_type", true), { kind: "next" });
  assert.deepEqual(gate("/accounts", "?rank=within_type", false), {
    kind: "redirect",
    to: "/sign-in?callbackUrl=%2Faccounts%3Frank%3Dwithin_type",
  });
});

test("API routes answer 401 without a session", () => {
  assert.deepEqual(gate("/api/data/lake", "", false), { kind: "unauthorized" });
  assert.deepEqual(gate("/api/data/lake", "", true), { kind: "next" });
});
