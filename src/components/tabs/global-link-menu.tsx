"use client";

import { useEffect, useRef, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { linkTarget } from "@/lib/tabs/link-target";

import { LinkMenuItems } from "./link-menu";

/** Below this the tab strip does not show (`max-md:hidden` in the layout), and
 *  the browser menu (which has share and copy on a long press) beats an "open
 *  in new tab" for an invisible strip. */
const WITH_STRIP = "(min-width: 768px)";

type Anchor = { href: string; x: number; y: number };

/**
 * The link menu of EVERY `<a href>` in the app shell, mounted once in
 * `(app)/layout.tsx`. One listener on the document: a new link gets the menu
 * without anyone remembering it. `linkTarget` decides who is in and who is
 * out.
 *
 * The listener is native and on the bubble phase, registered after React's
 * root, so any Radix menu deeper in the tree (a `Tabs` trigger) has already
 * handled the event and called `preventDefault`, and this one backs off.
 * Shift+right-click is the way out to the browser menu (inspect, copy the
 * selected text).
 *
 * It is a controlled `DropdownMenu` anchored to a 0×0 `span` at the click
 * point, the same virtual-anchor trick Radix's `ContextMenu` does inside, but
 * `ContextMenu` takes no `open` and cannot be opened from outside. It stays
 * modal (the default) on purpose: opened from inside a `Dialog`, a non-modal
 * menu would count as a click outside and close the dialog.
 */
export function GlobalLinkMenu() {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  /** Changes on every opening and keys the content: remounting is what makes
   *  Popper measure the anchor again when it moved. */
  const [opening, setOpening] = useState(0);
  const openRef = useRef(false);
  /** A right-click while the menu is open only closes it, like the native
   *  menu: Radix closes on `pointerdown`, and the `contextmenu` right after
   *  would land on `<html>` (the body has no pointer events while the modal
   *  menu is open) and open the browser menu over nothing. */
  const swallowRef = useRef(false);

  useEffect(() => {
    const onPointerDown = () => {
      swallowRef.current = openRef.current;
    };

    const onContextMenu = (e: MouseEvent) => {
      if (swallowRef.current) {
        swallowRef.current = false;
        e.preventDefault();
        return;
      }
      if (e.defaultPrevented || e.shiftKey) return;
      if (!window.matchMedia(WITH_STRIP).matches) return;

      const el = e.target instanceof Element ? e.target : null;
      const href = linkTarget(el, window.location.origin);
      if (!href) return;

      e.preventDefault();
      let { clientX: x, clientY: y } = e;
      // The keyboard's menu key: the event has no coordinates, and the menu
      // opens below the focused link.
      if (x === 0 && y === 0) {
        const r = el?.closest("a[href]")?.getBoundingClientRect();
        if (r) {
          x = r.left;
          y = r.bottom;
        }
      }
      setAnchor({ href, x, y });
      setOpening((n) => n + 1);
      openRef.current = true;
      setOpen(true);
    };

    // Capture: runs before Radix closes the menu on the same `pointerdown`.
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("contextmenu", onContextMenu);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, []);

  if (!anchor) return null;

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(v) => {
        openRef.current = v;
        setOpen(v);
      }}
    >
      <DropdownMenuTrigger asChild>
        <span
          aria-hidden
          className="pointer-events-none fixed size-0"
          style={{ left: anchor.x, top: anchor.y }}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        key={opening}
        align="start"
        sideOffset={2}
        className="w-52"
        // Focus does not go back to the invisible anchor.
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <LinkMenuItems href={anchor.href} Item={DropdownMenuItem} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
