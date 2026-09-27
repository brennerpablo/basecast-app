import assert from "node:assert/strict";
import { test } from "node:test";

import { MAIN_MENU, menuFor } from "./navigation";

test("the admin items show to superadmins only", () => {
  const ids = (isSuperAdmin: boolean) => menuFor(isSuperAdmin).map((item) => item.id);
  assert.ok(ids(true).includes("admin-users"));
  assert.ok(!ids(false).includes("admin-users"));
  assert.equal(ids(true).length, MAIN_MENU.length);
});

test("every admin item lives under /admin, where the layout checks", () => {
  for (const item of MAIN_MENU.filter((entry) => entry.superAdminOnly)) {
    assert.ok(item.href?.startsWith("/admin/"), item.id);
  }
});
