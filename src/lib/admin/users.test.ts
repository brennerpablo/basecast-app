import assert from "node:assert/strict";
import { test } from "node:test";

import { type AdminUserRow, signInMethod, userStats } from "./users";

test("the sign-in method follows the password hash and the Google id", () => {
  assert.equal(signInMethod(true, false), "Password");
  assert.equal(signInMethod(false, true), "Google");
  assert.equal(signInMethod(true, true), "Both");
});

const NOW = Date.parse("2026-09-27T12:00:00Z");
const row = (overrides: Partial<AdminUserRow>): AdminUserRow => ({
  id: "u",
  name: null,
  username: "u",
  email: "u@x.com",
  image: null,
  method: "Password",
  role: "User",
  createdAt: "2026-09-01T00:00:00Z",
  lastLoginAt: null,
  ...overrides,
});

test("the stats count Google users and the last 7 days", () => {
  const stats = userStats(
    [
      row({ method: "Password", createdAt: "2026-08-01T00:00:00Z", lastLoginAt: "2026-09-26T00:00:00Z" }),
      row({ method: "Google", createdAt: "2026-09-26T00:00:00Z", lastLoginAt: "2026-09-26T00:00:00Z" }),
      row({ method: "Both", createdAt: "2026-09-20T12:00:00Z", lastLoginAt: "2026-09-10T00:00:00Z" }),
      row({ method: "Google", createdAt: "2026-09-19T00:00:00Z", lastLoginAt: null }),
    ],
    NOW,
  );
  assert.deepEqual(stats, { total: 4, google: 3, newThisWeek: 2, activeThisWeek: 2 });
});

test("no users, no counts", () => {
  assert.deepEqual(userStats([], NOW), { total: 0, google: 0, newThisWeek: 0, activeThisWeek: 0 });
});
