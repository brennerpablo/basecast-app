import type { LucideIcon } from "lucide-react";

import { MAIN_MENU } from "@/lib/navigation";

import { pathOf, type Tab } from "./tabs-store";

export type UrlTitle = {
  title: string;
  icon?: LucideIcon;
};

/** Used when no menu item lights up on the path. */
export const APP_NAME = "BaseCast";

/**
 * A tab's default name, without help from the screen: **the label of the menu
 * item that lights up on it**, the name the person clicked. A sub-item wins
 * over its group; the icon is the item's (a sub-item inherits its group's).
 * The screen can do better through the breadcrumb (see `setTabTitle`): an
 * account page names the tab after the account.
 */
export function urlTitle(url: string): UrlTitle {
  const path = pathOf(url) || "/";
  for (const item of MAIN_MENU) {
    for (const sub of item.subItems ?? []) {
      if (sub.activeCheck ? sub.activeCheck(path) : sub.href === path) {
        return { title: sub.label, icon: item.icon };
      }
    }
    if (item.href && (item.activeCheck ? item.activeCheck(path) : item.href === path)) {
      return { title: item.label, icon: item.icon };
    }
  }
  return { title: APP_NAME };
}

/** What the tab shows: the name the user gave (pinned tabs only); else what
 *  the screen gave, while the tab is on the path where it was given; else the
 *  name derived from the URL. */
export function tabTitle(tab: Tab): string {
  if (tab.name) return tab.name;
  if (tab.title && tab.title.path === pathOf(tab.url)) return tab.title.text;
  return urlTitle(tab.url).title;
}
