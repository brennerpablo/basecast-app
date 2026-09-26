"use client";

import { AppWindow, Link2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { toast } from "sonner";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

import { useTabActions, useTabs } from "./use-tabs";

/** An app path's absolute URL on the clipboard: what gets pasted in a chat. */
export async function copyLink(href: string) {
  try {
    await navigator.clipboard.writeText(new URL(href, window.location.origin).href);
    toast.success("Link copied");
  } catch {
    toast.error("Could not copy the link");
  }
}

/**
 * A link's destination: the ready URL, or a function that builds it at the
 * moment of the gesture. That is the case of a screen's tabs
 * (`<Tabs urlParam>`), whose URL is the current one with a parameter changed
 * and so is only known on click.
 */
export type LinkHref = string | (() => string);

function resolveHref(href: LinkHref): string {
  return typeof href === "function" ? href() : href;
}

/** What the two items need from the item component: `ContextMenuItem` and
 *  `DropdownMenuItem` both fit. */
type MenuItem = ComponentType<{ onSelect?: () => void; children?: ReactNode }>;

/**
 * The right-click menu's content over an app destination: open it in a new
 * strip tab, or copy the address. Cmd/Ctrl+click and middle-click stay with
 * the browser (a BROWSER tab, the gesture everyone has in their fingers).
 *
 * Exported apart for whoever already has a menu and only needs the items;
 * `Item` swaps the primitive when that menu is a `DropdownMenu` (the case of
 * `GlobalLinkMenu`). Outside the app shell there is no strip, and the menu
 * only has "Copy link".
 */
export function LinkMenuItems({
  href,
  onOpen,
  Item = ContextMenuItem,
}: {
  href: LinkHref;
  /** After opening: the mobile sidebar closes, so the new tab shows. */
  onOpen?: () => void;
  Item?: MenuItem;
}) {
  const { open } = useTabActions();
  const hasStrip = useTabs() !== null;
  return (
    <>
      {hasStrip && (
        <Item
          onSelect={() => {
            open(resolveHref(href));
            onOpen?.();
          }}
        >
          <AppWindow />
          Open in new tab
        </Item>
      )}
      <Item onSelect={() => void copyLink(resolveHref(href))}>
        <Link2 />
        Copy link
      </Item>
    </>
  );
}

/**
 * A trigger that leads somewhere, with the menu above on right-click.
 *
 * **Do not wrap an `<a href>` / `Link` in it**: every link in the app shell
 * already gets this menu through `GlobalLinkMenu`. This is for a trigger that
 * is NOT an anchor, like a `Tabs` tab button, whose URL is only known at the
 * gesture.
 */
export function LinkMenu({
  href,
  onOpen,
  children,
}: {
  href: LinkHref;
  onOpen?: () => void;
  /** The element that gets the right-click: a single one, because the trigger
   *  is `asChild`. */
  children: ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        <LinkMenuItems href={href} onOpen={onOpen} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
