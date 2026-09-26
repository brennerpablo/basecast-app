"use client";

import {
  ChevronDownIcon,
  ChevronsDownIcon,
  ChevronsUpIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  BADGE_ON_ACCENT,
  BADGE_ON_ACCENT_HOVER,
} from "@/app/(app)/_components/sidebar-accent";
import { useSidebar } from "@/components/ui/sidebar";
import {
  MAIN_MENU,
  type MainMenuItem,
  SIDEBAR_EXPANDED_COOKIE,
} from "@/lib/navigation";
import { cn } from "@/lib/utils";

import { SidebarChrome } from "./sidebar-chrome";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function saveExpandedState(expandedItems: Set<string>) {
  const value = encodeURIComponent(JSON.stringify(Array.from(expandedItems)));
  document.cookie = `${SIDEBAR_EXPANDED_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE}`;
}

function isItemActive(item: MainMenuItem, pathname: string) {
  if (!item.href) return false;
  return item.activeCheck ? item.activeCheck(pathname) : pathname === item.href;
}

/** Ids of the groups that contain the current route. */
function groupsWithActiveChild(pathname: string) {
  return MAIN_MENU.flatMap((item) =>
    item.subItems?.some((sub) =>
      sub.activeCheck ? sub.activeCheck(pathname) : pathname === sub.href,
    )
      ? [item.id]
      : [],
  );
}

export function SidebarNav({
  initialExpanded,
}: {
  /** Expanded groups read from the cookie on the server, so both renders match. */
  initialExpanded?: string[];
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  // On mobile the menu is a drawer over the page: close it once a link is
  // chosen, or it keeps covering the page the user just opened.
  const closeDrawer = () => {
    if (isMobile) setOpenMobile(false);
  };
  const [expandedItems, setExpandedItems] = useState<Set<string>>(
    () => new Set(initialExpanded ?? []),
  );
  // Only true while a user-triggered toggle is in flight; keeps transitions off
  // for programmatic changes (pathname auto-expand).
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // Auto-expand the group that holds the current route. setState during render
  // (guarded by the changed prop) is the React 19 pattern for adjusting state
  // from a changed prop without an effect.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    const toExpand = groupsWithActiveChild(pathname).filter(
      (id) => !expandedItems.has(id),
    );
    if (toExpand.length > 0) {
      setExpandedItems(new Set([...expandedItems, ...toExpand]));
    }
  }

  useEffect(() => {
    saveExpandedState(expandedItems);
  }, [expandedItems]);

  const animateOnce = () => {
    setShouldAnimate(true);
    requestAnimationFrame(() => setShouldAnimate(false));
  };

  const toggleExpanded = (itemId: string) => {
    animateOnce();
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const groups = MAIN_MENU.filter((item) => item.subItems?.length);
  const hasAnyExpanded = groups.some((item) => expandedItems.has(item.id));

  const toggleAllMenus = () => {
    animateOnce();
    setExpandedItems(
      hasAnyExpanded ? new Set() : new Set(groups.map((item) => item.id)),
    );
  };

  const toggleAllButton =
    groups.length > 0 ? (
      <button
        type="button"
        onClick={toggleAllMenus}
        aria-label={hasAnyExpanded ? "Collapse all menus" : "Expand all menus"}
        className={cn(
          "flex min-h-8 w-full items-center justify-start gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors",
          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          "focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar",
          "text-sidebar-foreground/70",
        )}
      >
        {hasAnyExpanded ? (
          <ChevronsUpIcon className="size-3" />
        ) : (
          <ChevronsDownIcon className="size-3" />
        )}
      </button>
    ) : null;

  return (
    <SidebarChrome toolbar={toggleAllButton}>
      <nav className="w-full p-2">
        <div className="space-y-1">
          {MAIN_MENU.map((item) => {
            const Icon = item.icon;
            const isExpanded = expandedItems.has(item.id);
            const hasSubItems = Boolean(item.subItems?.length);
            const isActive = isItemActive(item, pathname);

            return (
              <div key={item.id} className="w-full">
                {!hasSubItems && item.href ? (
                  <Link
                    href={item.href}
                    onClick={closeDrawer}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      "hover:bg-brand hover:text-brand-foreground hover:[&_svg]:text-brand-foreground",
                      BADGE_ON_ACCENT_HOVER,
                      "focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar",
                      isActive
                        ? "bg-brand text-brand-foreground [&_svg]:text-brand-foreground"
                        : "text-sidebar-foreground",
                      isActive && BADGE_ON_ACCENT,
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "size-4 shrink-0 transition-colors",
                          !isActive && "text-sidebar-foreground/70",
                        )}
                      />
                      <span className="whitespace-nowrap text-left">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => hasSubItems && toggleExpanded(item.id)}
                    aria-expanded={hasSubItems ? isExpanded : undefined}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar",
                      hasSubItems ? "cursor-pointer" : "cursor-default",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="size-4 shrink-0 text-sidebar-foreground/70" />
                      <span className="whitespace-nowrap text-left text-sidebar-foreground">
                        {item.label}
                      </span>
                    </div>
                    {hasSubItems && (
                      <ChevronDownIcon
                        className={cn(
                          "size-4 shrink-0 text-sidebar-foreground/70",
                          shouldAnimate && "transition-transform duration-200",
                          isExpanded && "rotate-180",
                        )}
                      />
                    )}
                  </button>
                )}

                {hasSubItems && (
                  <div
                    className={cn(
                      shouldAnimate && "transition-all duration-200 ease-in-out",
                      isExpanded
                        ? "max-h-96 overflow-visible opacity-100"
                        : "max-h-0 overflow-hidden opacity-0",
                    )}
                  >
                    <div className="ml-7 mt-1 space-y-1 border-l border-sidebar-border pl-3">
                      {item.subItems?.map((subItem) => {
                        const isSubItemActive = subItem.activeCheck
                          ? subItem.activeCheck(pathname)
                          : pathname === subItem.href;
                        return (
                          <Link
                            key={subItem.id}
                            href={subItem.href}
                            onClick={closeDrawer}
                            aria-current={isSubItemActive ? "page" : undefined}
                            className={cn(
                              "flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground/70 transition-colors",
                              !isSubItemActive &&
                                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                              "focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar",
                              "whitespace-nowrap text-left",
                              isSubItemActive &&
                                "bg-brand text-brand-foreground",
                              isSubItemActive && BADGE_ON_ACCENT,
                            )}
                          >
                            {subItem.label}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>
    </SidebarChrome>
  );
}
