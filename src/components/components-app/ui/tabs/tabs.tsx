"use client";

import { parseAsString, useQueryState } from "nuqs";
import { Tabs } from "radix-ui";
import * as React from "react";

import { LinkMenu } from "@/components/tabs/link-menu";
import { tabUrl } from "@/lib/tabs/tab-url";
import { cn } from "@/lib/utils";

type TabsVariant = "line" | "solid";
type TabsColor =
  | "default"
  | "blue"
  | "red"
  | "green"
  | "orange"
  | "purple"
  | "indigo"
  | "pink"
  | "yellow"
  | "emerald";

type TabsListContext = { variant: TabsVariant; color: TabsColor };

const TabsListContext = React.createContext<TabsListContext>({
  variant: "line",
  color: "default"});

// Static class maps so Tailwind doesn't purge them
const lineActiveClasses: Record<TabsColor, string> = {
  default: "data-[state=active]:border-foreground data-[state=active]:text-foreground",
  blue:    "data-[state=active]:border-blue-500 data-[state=active]:text-blue-600",
  red:     "data-[state=active]:border-red-500 data-[state=active]:text-red-600",
  green:   "data-[state=active]:border-green-500 data-[state=active]:text-green-600",
  orange:  "data-[state=active]:border-orange-500 data-[state=active]:text-orange-600",
  purple:  "data-[state=active]:border-purple-500 data-[state=active]:text-purple-600",
  indigo:  "data-[state=active]:border-indigo-500 data-[state=active]:text-indigo-600",
  pink:    "data-[state=active]:border-pink-500 data-[state=active]:text-pink-600",
  yellow:  "data-[state=active]:border-yellow-500 data-[state=active]:text-yellow-600",
  emerald: "data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-600"};

const solidActiveClasses: Record<TabsColor, string> = {
  default: "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
  blue:    "data-[state=active]:bg-blue-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
  red:     "data-[state=active]:bg-red-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
  green:   "data-[state=active]:bg-green-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
  orange:  "data-[state=active]:bg-orange-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
  purple:  "data-[state=active]:bg-purple-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
  indigo:  "data-[state=active]:bg-indigo-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
  pink:    "data-[state=active]:bg-pink-500 data-[state=active]:text-white data-[state=active]:shadow-sm",
  yellow:  "data-[state=active]:bg-yellow-400 data-[state=active]:text-white data-[state=active]:shadow-sm",
  emerald: "data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-sm"};

/**
 * Where a screen tab leads, by value. With it, a tab is a destination like a
 * link: the right-click menu ("Open in new tab", "Copy link") and
 * Cmd/Ctrl+click or middle-click into a browser tab. `null` for tabs that are
 * not places (a dialog's, a form's, a filter's).
 */
type TabHref = (value: string) => string;

const TabsHrefContext = React.createContext<TabHref | null>(null);

type TabsRootProps = React.ComponentProps<typeof Tabs.Root> & {
  /**
   * The search param that holds the active tab (`?tab=`). When set on an
   * uncontrolled `Tabs`, the value lives in the URL, so a tab can be linked to
   * and survives a reload.
   */
  urlParam?: string;
  /**
   * For tabs that switch pages rather than a URL parameter: the route of each
   * value. Makes the tabs destinations, like `urlParam` does.
   */
  tabHref?: TabHref;
};

function TabsRoot({ className, urlParam, tabHref, ...props }: TabsRootProps) {
  const classes = cn("w-full", className);
  const defaultValue = props.defaultValue;
  const href = React.useMemo<TabHref | null>(
    () =>
      tabHref ??
      (urlParam
        ? // Read from `window.location` at the gesture, not from
          // `useSearchParams`: the hook would ask for a `<Suspense>` around
          // every screen with tabs, and the URL only matters on click.
          (value: string) => tabUrl(window.location.href, urlParam, value, defaultValue)
        : null),
    [tabHref, urlParam, defaultValue],
  );
  const root =
    urlParam && props.value === undefined ? (
      <TabsRootInUrl className={classes} urlParam={urlParam} {...props} />
    ) : (
      <Tabs.Root className={classes} {...props} />
    );
  return <TabsHrefContext.Provider value={href}>{root}</TabsHrefContext.Provider>;
}

/**
 * `<Tabs defaultValue urlParam>`: the chosen tab goes to `?<urlParam>=` and the
 * default is dropped from the URL. `history: "replace"`, so switching tabs does
 * not pile up Back entries.
 */
function TabsRootInUrl({
  urlParam,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof Tabs.Root> & { urlParam: string }) {
  const [value, setValue] = useQueryState(
    urlParam,
    parseAsString.withDefault(defaultValue ?? ""),
  );
  return (
    <Tabs.Root
      {...props}
      value={value}
      onValueChange={(next) => {
        void setValue(next);
        onValueChange?.(next);
      }}
    />
  );
}

function TabsList({
  variant = "line",
  color = "default",
  className,
  children,
  ...props
}: React.ComponentProps<typeof Tabs.List> & {
  variant?: TabsVariant;
  color?: TabsColor;
}) {
  return (
    <TabsListContext.Provider value={{ variant, color }}>
      <Tabs.List
        className={cn(
          "max-w-full overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
          // The baseline is an inset shadow, not `border-b`: the list scrolls
          // horizontally, so it clips whatever leaves its box, and an active
          // underline pulled 1px over a border would be cut in half.
          variant === "line" &&
            "flex items-end gap-1 shadow-[inset_0_-1px_0_0_var(--color-border)]",
          variant === "solid" &&
            "inline-flex items-center rounded-lg bg-muted p-1 gap-1",
          className,
        )}
        {...props}
      >
        {children}
      </Tabs.List>
    </TabsListContext.Provider>
  );
}

function TabsTrigger({
  className,
  onMouseDown,
  onClick,
  onAuxClick,
  ...props
}: React.ComponentProps<typeof Tabs.Trigger>) {
  const { variant, color } = React.useContext(TabsListContext);
  const tabHref = React.useContext(TabsHrefContext);
  const href = tabHref && !props.disabled ? () => tabHref(props.value) : null;

  const trigger = (
    <Tabs.Trigger
      // Radix activates the tab on `mousedown` of any left button without
      // Ctrl, Cmd included on the Mac. With a destination, a modified click
      // belongs to the browser, as on a link: `preventDefault` here stops Radix
      // (the handlers are composed and it respects `defaultPrevented`).
      onMouseDown={(e) => {
        onMouseDown?.(e);
        if (!href) return;
        const modified = e.button === 0 && (e.metaKey || e.ctrlKey || e.shiftKey);
        if (modified || e.button === 1) e.preventDefault();
      }}
      onClick={(e) => {
        onClick?.(e);
        if (href && e.button === 0 && (e.metaKey || e.ctrlKey || e.shiftKey)) {
          e.preventDefault();
          window.open(href(), "_blank", "noopener");
        }
      }}
      onAuxClick={(e) => {
        onAuxClick?.(e);
        if (href && e.button === 1) {
          e.preventDefault();
          window.open(href(), "_blank", "noopener");
        }
      }}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
        variant === "line" &&
          cn(
            "px-3 pb-2 font-normal text-muted-foreground hover:text-foreground hover:border-foreground/50 border-b-2 border-transparent",
            lineActiveClasses[color],
          ),
        variant === "solid" &&
          cn(
            "px-3 py-1.5 rounded-md font-normal text-muted-foreground hover:text-foreground",
            solidActiveClasses[color],
          ),
        className,
      )}
      {...props}
    />
  );

  if (!href) return trigger;
  // The menu wraps a `<span className="contents">`, not the button: the
  // `ContextMenu` trigger injects `data-state="open|closed"` into its child,
  // and Radix Tabs spreads props AFTER its own `data-state="active"`, so the
  // active tab would lose its style. `contextmenu` bubbles from the button to
  // the span, and `display: contents` leaves the list's layout alone.
  return (
    <LinkMenu href={href}>
      <span className="contents">{trigger}</span>
    </LinkMenu>
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Content>) {
  return (
    <Tabs.Content
      className={cn("mt-4 outline-none", className)}
      {...props}
    />
  );
}

export { TabsRoot as Tabs, TabsContent, TabsList, TabsTrigger };
export type { TabsColor, TabsVariant };
