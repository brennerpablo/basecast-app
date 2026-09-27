import assert from "node:assert/strict";
import { test } from "node:test";

import { ADMIN_USERS_ROUTE } from "./navigation";

test("the user menu's admin screen lives under /admin, where the layout checks", () => {
  assert.ok(ADMIN_USERS_ROUTE.href.startsWith("/admin/"));
});
