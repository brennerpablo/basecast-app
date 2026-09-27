import assert from "node:assert/strict";
import { test } from "node:test";

import { USERNAME_PATTERN } from "./credentials";
import { pickUsername, planGoogleSignIn, usernameFromEmail } from "./google";

test("a Google user's username comes from their email's local part", () => {
  assert.equal(usernameFromEmail("jane.doe@gmail.com"), "jane.doe");
  assert.equal(usernameFromEmail("Jane.Doe+work@x.com"), "jane.doework");
  assert.equal(usernameFromEmail("_-.maria@x.com"), "maria");
});

test("a short or empty local part is padded to a valid username", () => {
  assert.equal(usernameFromEmail("jo@x.com"), "jo0");
  assert.equal(usernameFromEmail("é@x.com"), "user");
  assert.equal(usernameFromEmail("+@x.com"), "user");
});

test("every derived username passes USERNAME_PATTERN", () => {
  for (const email of ["a@x.com", "ÁÉÍ@x.com", `${"x".repeat(60)}@x.com`, "a.b-c_d@x.com", "..@x.com"]) {
    assert.match(usernameFromEmail(email), USERNAME_PATTERN, email);
  }
});

test("a taken username gets the first free numeric suffix", () => {
  assert.equal(pickUsername("jane", new Set()), "jane");
  assert.equal(pickUsername("jane", new Set(["jane"])), "jane-2");
  assert.equal(pickUsername("jane", new Set(["jane", "jane-2", "jane-3"])), "jane-4");
});

test("the suffix replaces the end of a 32-character username", () => {
  const base = "x".repeat(32);
  const picked = pickUsername(base, new Set([base]));
  assert.equal(picked, `${"x".repeat(30)}-2`);
  assert.match(picked, USERNAME_PATTERN);
});

const verified = { email: "jane@x.com", email_verified: true };

test("a known Google id signs in as its user", () => {
  assert.deepEqual(planGoogleSignIn(verified, { id: "u1", googleId: "g1" }, null), {
    kind: "existing",
    userId: "u1",
  });
});

test("a verified email with no user creates one", () => {
  assert.deepEqual(planGoogleSignIn(verified, null, null), { kind: "create" });
});

test("a verified email of a password user links Google to that user", () => {
  assert.deepEqual(planGoogleSignIn(verified, null, { id: "u1", googleId: null }), {
    kind: "link",
    userId: "u1",
  });
});

test("an unverified or missing email never links or creates", () => {
  const unverified = { email: "jane@x.com", email_verified: false };
  assert.equal(planGoogleSignIn(unverified, null, null).kind, "reject");
  assert.equal(planGoogleSignIn(unverified, null, { id: "u1", googleId: null }).kind, "reject");
  assert.equal(planGoogleSignIn({ email_verified: true }, null, null).kind, "reject");
});

test("an email already tied to another Google account is refused", () => {
  assert.deepEqual(planGoogleSignIn(verified, null, { id: "u1", googleId: "g-other" }), {
    kind: "reject",
    reason: "email_taken_by_other_google_account",
  });
});
