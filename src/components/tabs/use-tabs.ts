"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useSyncExternalStore } from "react";

import {
  activateTab,
  claimCurrentEntry,
  closeOtherTabs,
  closeTab,
  closeTabsToRight,
  documentUrl,
  duplicateTab,
  getServerTabs,
  getTabs,
  markTabNavigation,
  moveTab,
  openTab,
  pinTab,
  renameTab,
  setTabTitle,
  subscribeTabs,
  type Tab,
} from "@/lib/tabs/tabs-store";

/** The tab list and the active tab; `null` before the strip builds the state
 *  (and on the server). */
export function useTabs() {
  return useSyncExternalStore(subscribeTabs, getTabs, getServerTabs);
}

/**
 * The tab operations, already bound to the router. Changing the active tab is
 * navigating to its URL; when the document is already at that URL
 * (duplicating the active tab, "open in new tab" on the current screen) there
 * is no navigation, and the current history entry just changes owner.
 */
export function useTabActions() {
  const router = useRouter();
  return useMemo(() => {
    const goTo = (tab: Tab | null, mode: "push" | "replace" = "push") => {
      if (!tab) return;
      if (documentUrl() === tab.url) {
        claimCurrentEntry(tab.id);
        return;
      }
      markTabNavigation(tab.id, tab.url);
      // `replace` when closing the active tab: the entry that showed it now
      // belongs to the neighbor, and Back does not reopen the closed screen.
      if (mode === "replace") router.replace(tab.url);
      else router.push(tab.url);
    };
    return {
      open: (url: string, where?: "next" | "end") => goTo(openTab(url, where)),
      activate: (id: string) => goTo(activateTab(id)),
      close: (id: string) => goTo(closeTab(id), "replace"),
      closeOthers: (id: string) => goTo(closeOtherTabs(id)),
      closeToRight: (id: string) => goTo(closeTabsToRight(id)),
      duplicate: (id: string) => goTo(duplicateTab(id)),
      move: moveTab,
      pin: (id: string, pin: boolean) => pinTab(id, pin),
      rename: renameTab,
    };
  }, [router]);
}

/** Loading labels a breadcrumb shows before the data arrives. */
const PLACEHOLDER_TITLE = /^[\s.…-]*$/;

/**
 * The screen names the tab it is in, in place of the menu item's label. Most
 * screens do not need to call this: the last breadcrumb item
 * (`<PageBreadcrumb>`) already is the name. It is for a screen that declares
 * no breadcrumb, or whose breadcrumb ends in a generic label.
 *
 * Page screens only: a dialog over another screen does not rename the tab,
 * because the name holds per PATH and a dialog does not change the path; once
 * closed, the tab would keep the dialog's name.
 */
export function useTabTitle(title: string | null | undefined) {
  const path = usePathname() as string | null;
  const text = title?.trim();
  useEffect(() => {
    if (text && !PLACEHOLDER_TITLE.test(text) && path) setTabTitle(text, path);
  }, [text, path]);
}
