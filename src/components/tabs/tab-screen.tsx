"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  type Dispatch,
  Fragment,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  confirmMountedScreen,
  getInitialTab,
  readScreenState,
  screenOwner,
  writeScreenState,
} from "@/lib/tabs/tabs-store";

import { useTabs } from "./use-tabs";

type VisibleScreen = {
  /** The tab that owns the visible screen; `null` before the state exists. */
  tab: string | null;
  path: string;
};

const ScreenContext = createContext<VisibleScreen | null>(null);

/**
 * Tells whom the visible screen belongs to, and gives each tab its own
 * instance of it. Wraps the shell's content area.
 *
 * **A `key` per owner tab**, as in upstate-ops (fundsys has none because its
 * `cacheComponents` keeps the last routes mounted in a hidden `<Activity>`,
 * which a key would throw away; basecast does not turn it on). Two tabs on the
 * same screen (the same table with different filters, the obvious use of
 * tabs) have the SAME path, and Next would not remount the page between them:
 * the second tab would show the first one's `useState`. With the key, every
 * tab switch remounts, and the screen that mounts reads what was its own from
 * `useTabState`.
 *
 * The first load stays under the "initial" key, from the server until the
 * strip builds the state, and after that too while the owner is the tab the
 * page loaded in. Without it the whole screen would remount right after
 * hydration.
 */
export function TabScreen({ children }: { children: ReactNode }) {
  const path = usePathname();
  // Subscribes to the state: the owner changes when the active tab changes,
  // even without a navigation (duplicating the current tab, switching to a
  // tab on the same URL).
  useTabs();
  const tab = screenOwner(path);
  const key = tab === null || tab === getInitialTab() ? "initial" : tab;

  useEffect(() => {
    if (tab) confirmMountedScreen(tab);
  }, [tab]);

  const info = useMemo(() => ({ tab, path }), [tab, path]);

  return (
    <ScreenContext.Provider value={info}>
      <Fragment key={key}>{children}</Fragment>
    </ScreenContext.Provider>
  );
}

function resolve<T>(initial: T | (() => T)): T {
  return typeof initial === "function" ? (initial as () => T)() : initial;
}

type Kept<T> = { owner: string | null; value: T };

/**
 * A `useState` that belongs to each TAB: the value is kept per tab and per
 * path, and a screen that comes back (a tab switch, Back/Forward, a link to a
 * path the tab already visited) starts where it was.
 *
 * It is for what the screen keeps OUTSIDE the URL and hurts to lose: table
 * filters, sorting and columns. What is in the URL comes back on its own. The
 * value lives in memory, so F5 restarts the screen, except on a PINNED tab,
 * which stores the value for its path with it in `localStorage` and brings it
 * back on F5 and in a new window. So the value must fit in JSON (`Date` is
 * accepted).
 *
 * The owner can also change without a remount: when the state is born after
 * hydration, the screen already on display adopts the active tab. Outside
 * `TabScreen` it is a plain `useState`.
 */
export function useTabState<T>(
  key: string,
  initial: T | (() => T),
): [T, Dispatch<SetStateAction<T>>] {
  const screen = useContext(ScreenContext);
  // A component in a layout that spans several paths keeps the first one.
  const [myPath] = useState(() => screen?.path ?? null);
  const visibleOwner = screen !== null && screen.path === myPath ? screen.tab : null;

  const [kept, setKept] = useState<Kept<T>>(() => {
    if (visibleOwner && myPath) {
      const stored = readScreenState(visibleOwner, myPath, key);
      if (stored) return { owner: visibleOwner, value: stored.value as T };
    }
    return { owner: visibleOwner, value: resolve(initial) };
  });

  // Owner change, adjusted during render (React's derived-state pattern): the
  // screen shows up with the right value, without a frame of the other tab's.
  let current = kept;
  if (visibleOwner && myPath && visibleOwner !== kept.owner) {
    const stored = readScreenState(visibleOwner, myPath, key);
    if (kept.owner === null) {
      // First load: the tab state was just born, and the screen already on
      // display belongs to the active tab; it adopts without changing the
      // value. Unless the tab is a pinned one that came back with stored
      // state: adopting the initial value would write the pinned tab
      // unfiltered over what it brought.
      current = { owner: visibleOwner, value: stored ? (stored.value as T) : kept.value };
    } else {
      current = { owner: visibleOwner, value: stored ? (stored.value as T) : resolve(initial) };
    }
    setKept(current);
  }

  const { owner, value } = current;
  useEffect(() => {
    if (owner && myPath) writeScreenState(owner, myPath, key, value);
  }, [owner, myPath, key, value]);

  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setKept((before) => ({
      owner: before.owner,
      value: typeof action === "function" ? (action as (v: T) => T)(before.value) : action,
    }));
  }, []);

  return [value, setValue];
}
