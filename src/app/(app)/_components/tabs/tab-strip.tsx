"use client";

import { CopyPlus, Link2, Pencil, Pin, PinOff, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { memo, Suspense, useEffect, useRef, useState } from "react";

import { copyLink } from "@/components/tabs/link-menu";
import { useTabActions, useTabs } from "@/components/tabs/use-tabs";
import { ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu";
import { MAIN_MENU } from "@/lib/navigation";
import { APP_NAME, tabTitle, urlTitle } from "@/lib/tabs/tab-title";
import {
  initTabs,
  MAX_NAME_LENGTH,
  moveTab,
  normalizeUrl,
  receiveUrl,
  type Tab,
} from "@/lib/tabs/tabs-store";
import { cn } from "@/lib/utils";

import { NewTabButton, TabItem, TabList, useDragScope } from "./tab-visual";

type Actions = ReturnType<typeof useTabActions>;

/** Where the "+" opens: the first menu item (`/` only redirects to it). */
const NEW_TAB_URL = MAIN_MENU[0]?.href ?? "/";

/**
 * The app's tabs, in the middle of the card's first row, after the sidebar
 * trigger and over the rule that separates them from the breadcrumb (which
 * moves down as the screen's title). Each tab is a URL of the app itself;
 * switching tabs is navigating to it. The rules (who owns each URL change,
 * Back/Forward, what is stored) are in the header of `src/lib/tabs/tabs-store.ts`.
 *
 * `owner` keys the stored list: a constant in the public demo, the user once
 * there is login, so two people on one browser do not share tabs.
 *
 * The `<Suspense>` is what `useSearchParams` asks for in a layout component,
 * and it wraps only the tabs: the sidebar trigger does not wait for them.
 */
export function TabStrip({ owner, className }: { owner: string; className?: string }) {
  return (
    <Suspense fallback={<div className={cn("min-w-0 flex-1", className)} aria-hidden />}>
      <Strip owner={owner} className={className} />
    </Suspense>
  );
}

function Strip({ owner, className }: { owner: string; className?: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const url = normalizeUrl(search ? `${pathname}?${search}` : pathname);
  const state = useTabs();
  const actions = useTabActions();
  const scope = useDragScope("app-tab");

  // Every URL change goes to the tab that owns it; the first builds the state.
  useEffect(() => {
    if (!initTabs(owner, url)) receiveUrl(url);
  }, [owner, url]);

  const active = state?.tabs.find((t) => t.id === state.active) ?? null;
  const activeTitle = active ? tabTitle(active) : urlTitle(url).title;

  // The active tab's name goes to the BROWSER tab too. Writing it once is not
  // enough: Next re-renders the metadata <title> after every navigation (and
  // an account's name arrives AFTER it), and Next's would win. The <head>
  // observer puts ours back whenever Next swaps it; writing the same value
  // changes nothing, so there is no loop.
  const documentTitle = `${activeTitle} · ${APP_NAME}`;
  const wantedTitle = useRef(documentTitle);
  useEffect(() => {
    wantedTitle.current = documentTitle;
    if (document.title !== documentTitle) document.title = documentTitle;
  }, [documentTitle]);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (document.title !== wantedTitle.current) document.title = wantedTitle.current;
    });
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      // Outside the app shell, the title goes back to the metadata's.
      document.title = APP_NAME;
    };
  }, []);

  // Before the state exists (on the server and during hydration), the strip
  // draws a single tab with the request URL; the stored list comes right
  // after.
  const ready = state !== null;
  const list: readonly Tab[] = state?.tabs ?? [{ id: "initial", url, activatedAt: 0 }];
  const activeId = state?.active ?? "initial";

  return (
    <TabList
      scope={scope}
      ids={list.map((t) => t.id)}
      activeId={activeId}
      onMove={moveTab}
      label="Open tabs"
      className={className}
      after={
        <NewTabButton
          label="New tab"
          disabled={!ready}
          onClick={() => actions.open(NEW_TAB_URL, "end")}
        />
      }
    >
      {list.map((tab, index) => {
        const after = list.slice(index + 1);
        return (
          <StripTab
            key={tab.id}
            scope={scope}
            tab={tab}
            active={tab.id === activeId}
            only={list.length === 1}
            // Neither bulk close takes pinned tabs: with no unpinned tab to
            // close, the item is disabled.
            noOthers={list.every((t) => t.id === tab.id || t.pinned)}
            noneToRight={after.every((t) => t.pinned)}
            // The rule between the last pinned tab and the first unpinned one.
            lastPinned={!!tab.pinned && after.length > 0 && !after[0].pinned}
            interactive={ready}
            actions={actions}
          />
        );
      })}
    </TabList>
  );
}

/**
 * Memoized: the strip renders on every URL change (every keystroke in a filter
 * that lives in the query) and again when the store publishes. Every prop is
 * stable (`actions` and `scope` by construction; an unchanged tab object keeps
 * its identity in the store), so only the tab that changed renders.
 */
const StripTab = memo(function StripTab({
  scope,
  tab,
  active,
  only,
  noOthers,
  noneToRight,
  lastPinned,
  interactive,
  actions,
}: {
  scope: symbol;
  tab: Tab;
  active: boolean;
  only: boolean;
  noOthers: boolean;
  noneToRight: boolean;
  lastPinned: boolean;
  /** False only in the server render, before the state exists. */
  interactive: boolean;
  actions: Actions;
}) {
  const title = tabTitle(tab);
  const { icon } = urlTitle(tab.url);
  const [editing, setEditing] = useState(false);

  return (
    <TabItem
      scope={scope}
      id={tab.id}
      title={title}
      Icon={icon}
      href={tab.url}
      active={active}
      interactive={interactive}
      onActivate={() => actions.activate(tab.id)}
      onClose={only ? undefined : () => actions.close(tab.id)}
      pinned={tab.pinned}
      onUnpin={() => actions.pin(tab.id, false)}
      lastPinned={lastPinned}
      editing={editing}
      maxNameLength={MAX_NAME_LENGTH}
      onEditEnd={(name) => {
        setEditing(false);
        // Enter without a change does not freeze the automatic name as a
        // given one.
        if (name !== null && name.trim() !== title) actions.rename(tab.id, name);
      }}
      menu={
        <>
          <ContextMenuItem onSelect={() => actions.duplicate(tab.id)}>
            <CopyPlus />
            Duplicate tab
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => void copyLink(tab.url)}>
            <Link2 />
            Copy link
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => actions.pin(tab.id, !tab.pinned)}>
            {tab.pinned ? <PinOff /> : <Pin />}
            {tab.pinned ? "Unpin tab" : "Pin tab"}
          </ContextMenuItem>
          {/* Renaming is for pinned tabs: unpinning brings back the automatic
              name. An empty field does too. */}
          <ContextMenuItem disabled={!tab.pinned} onSelect={() => setEditing(true)}>
            <Pencil />
            Rename tab
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem disabled={only} onSelect={() => actions.close(tab.id)}>
            <X />
            Close tab
          </ContextMenuItem>
          <ContextMenuItem inset disabled={noOthers} onSelect={() => actions.closeOthers(tab.id)}>
            Close other tabs
          </ContextMenuItem>
          <ContextMenuItem inset disabled={noneToRight} onSelect={() => actions.closeToRight(tab.id)}>
            Close tabs to the right
          </ContextMenuItem>
        </>
      }
    />
  );
});
