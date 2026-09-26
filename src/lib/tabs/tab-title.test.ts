import assert from "node:assert/strict";
import { test } from "node:test";

import { MAIN_MENU, OTHER_ROUTES } from "@/lib/navigation";

import { APP_NAME, tabTitle, urlTitle } from "./tab-title";

test("every menu item names its own tab, with its icon", () => {
  for (const item of MAIN_MENU) {
    if (!item.href) continue;
    const { title, icon } = urlTitle(item.href);
    assert.equal(title, item.label, item.href);
    assert.equal(icon, item.icon, item.href);
  }
});

test("a screen outside the menu names its tab too, with its icon", () => {
  for (const route of OTHER_ROUTES) {
    assert.deepEqual(urlTitle(route.href), { title: route.label, icon: route.icon });
  }
});

test("a page below a menu item takes the item's name; query does not matter", () => {
  assert.equal(urlTitle("/accounts/42?tab=triggers").title, "Accounts");
});

test("a path no menu item lights up is the app's name", () => {
  assert.equal(urlTitle("/somewhere").title, APP_NAME);
});

test("the given name beats the screen's title, which beats the URL's", () => {
  const tab = { id: "t", url: "/accounts/42", activatedAt: 0 };
  assert.equal(tabTitle(tab), "Accounts");
  const titled = { ...tab, title: { text: "Bluebonnet EC", path: "/accounts/42" } };
  assert.equal(tabTitle(titled), "Bluebonnet EC");
  // Off the path where the screen named it, the title comes from the URL.
  assert.equal(tabTitle({ ...titled, url: "/accounts" }), "Accounts");
  assert.equal(tabTitle({ ...titled, pinned: true, name: "Key co-op" }), "Key co-op");
});
