"use client";

import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import { getReorderDestinationIndex } from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import { DropIndicator } from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import type { LucideIcon } from "lucide-react";
import { Pin, Plus, X } from "lucide-react";
import Link from "next/link";
import {
  type ComponentProps,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";

/**
 * How a tab looks and what its gestures do. `TabStrip` only brings the data
 * and what each gesture does; the tab itself lives here.
 *
 * Dragging is per LIST: each list creates its own `scope` (`useDragScope`),
 * so a tab never drops into another draggable list (a table's columns).
 */

type DragData = { scope: symbol; id: string };

function dataInScope(scope: symbol, data: Record<string | symbol, unknown>): DragData | null {
  const d = data as Partial<DragData>;
  return d.scope === scope && typeof d.id === "string" ? { scope, id: d.id } : null;
}

/** One drag scope per list, stable for its lifetime. */
export function useDragScope(name: string): symbol {
  const [scope] = useState(() => Symbol(name));
  return scope;
}

// ---------------------------------------------------------------------------
// The list

/**
 * The scrollable tab list: arrows move without activating (Enter activates),
 * the vertical wheel scrolls horizontally, the active tab is always in view,
 * and dropping a dragged tab calls `onMove(id, index)`.
 */
export function TabList({
  scope,
  ids,
  activeId,
  onMove,
  label,
  children,
  after,
  className,
}: {
  scope: symbol;
  /** The current order: the drag's target index comes from it. */
  ids: readonly string[];
  activeId: string | null;
  onMove: (id: string, index: number) => void;
  label: string;
  children: ReactNode;
  /** What comes right after the tabs, outside the scroll (the "+"). */
  after?: ReactNode;
  className?: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // The monitor reads the order by ref and subscribes ONCE: a monitor
  // registered in the middle of a drag does not get its drop.
  const latest = useRef({ ids, onMove });
  useEffect(() => {
    latest.current = { ids, onMove };
  });
  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => dataInScope(scope, source.data) !== null,
        onDrop: ({ source, location }) => {
          const dropTarget = location.current.dropTargets[0];
          const from = dataInScope(scope, source.data);
          const over = dropTarget ? dataInScope(scope, dropTarget.data) : null;
          if (!from || !over || !dropTarget) return;
          const { ids: order, onMove: move } = latest.current;
          const startIndex = order.indexOf(from.id);
          const indexOfTarget = order.indexOf(over.id);
          if (startIndex < 0 || indexOfTarget < 0) return;
          move(
            from.id,
            getReorderDestinationIndex({
              startIndex,
              indexOfTarget,
              closestEdgeOfTarget: extractClosestEdge(dropTarget.data),
              axis: "horizontal",
            }),
          );
        },
      }),
    [scope],
  );

  // The active tab always in view, including one just opened at the end of a
  // list that already scrolls.
  const count = ids.length;
  useEffect(() => {
    const sc = scroller.current;
    const el = activeId
      ? sc?.querySelector<HTMLElement>(`[data-tab="${CSS.escape(activeId)}"]`)
      : null;
    if (!sc || !el) return;
    const start = el.offsetLeft;
    const end = start + el.offsetWidth;
    if (start < sc.scrollLeft) sc.scrollLeft = start - 8;
    else if (end > sc.scrollLeft + sc.clientWidth) sc.scrollLeft = end - sc.clientWidth + 8;
  }, [activeId, count]);

  // Arrows move between tabs without activating them (Enter activates): the
  // manual-activation tab list pattern. Switching tabs is navigating, and
  // passing three tabs to reach the fourth must not cost three navigations.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const tabs = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')];
    const i = tabs.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    const targets: Record<string, number> = {
      ArrowRight: (i + 1) % tabs.length,
      ArrowLeft: (i - 1 + tabs.length) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    const j = targets[e.key];
    if (j === undefined) return;
    e.preventDefault();
    tabs[j].focus();
  }

  return (
    <div className={cn("flex min-w-0 flex-1 items-stretch", className)}>
      <div
        ref={scroller}
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        onWheel={(e) => {
          // The vertical wheel scrolls the strip horizontally, like the
          // browser's.
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
        className="relative flex min-w-0 items-stretch overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {after}
    </div>
  );
}

/** The "+" after the tabs. */
export function NewTabButton({
  label,
  className,
  ...props
}: ComponentProps<"button"> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "ml-1 flex size-7 shrink-0 items-center justify-center self-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Plus className="size-4" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// The tab

export function TabItem({
  scope,
  id,
  title,
  hint,
  Icon,
  href,
  active,
  interactive = true,
  onActivate,
  onClose,
  pinned,
  onUnpin,
  lastPinned,
  menu,
  editing = false,
  maxNameLength,
  onEditEnd,
}: {
  scope: symbol;
  id: string;
  title: string;
  /** The `title` tooltip; the title itself without it. */
  hint?: string;
  Icon?: LucideIcon;
  /** With a URL the tab is a link: Cmd/Ctrl+click opens it in a browser tab. */
  href?: string;
  active: boolean;
  /** False only in the server render, before the state exists. */
  interactive?: boolean;
  onActivate: () => void;
  /** Without it the tab does not close (the strip's last tab). */
  onClose?: () => void;
  /** Pinned: a pin instead of the X, and middle-click does not close. */
  pinned?: boolean;
  onUnpin?: () => void;
  /** The rule between the last pinned tab and the first unpinned one. */
  lastPinned?: boolean;
  /** The right-click menu's items. */
  menu?: ReactNode;
  /** The name becomes a field (rename): Enter or leaving the field confirms,
   *  Esc cancels. `onEditEnd` gets the text, or `null` on cancel. */
  editing?: boolean;
  maxNameLength?: number;
  onEditEnd?: (name: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The context menu gives focus back to the tab when it closes, after the
  // field mounted. Without refusing that, the field loses focus at once and
  // the edit ends before it starts.
  const editingNow = useRef(editing);
  useEffect(() => {
    editingNow.current = editing;
  });
  const [edge, setEdge] = useState<Edge | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // While editing the tab does not drag: selecting the field's text would
    // become a drag.
    if (!el || !interactive || editing) return;
    const data: DragData = { scope, id };
    return combine(
      draggable({
        element: el,
        getInitialData: () => data,
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: el,
        canDrop: ({ source }) => dataInScope(scope, source.data) !== null,
        getData: ({ input, element }) =>
          attachClosestEdge(data, { input, element, allowedEdges: ["left", "right"] }),
        onDrag: ({ self, source }) => {
          const same = dataInScope(scope, source.data)?.id === id;
          setEdge(same ? null : extractClosestEdge(self.data));
        },
        onDragLeave: () => setEdge(null),
        onDrop: () => setEdge(null),
      }),
    );
  }, [scope, id, interactive, editing]);

  const noButton = !pinned && !onClose;
  const tabProps = {
    role: "tab",
    "aria-selected": active,
    tabIndex: active ? 0 : -1,
    // The whole tab drags (the `div`), not the link: an `<a>` is draggable on
    // its own and would carry just the URL.
    draggable: false,
    title: hint ?? title,
    onClick: (e: MouseEvent<HTMLElement>) => {
      // Cmd/Ctrl/Shift+click on a link stays with the browser: the tab opens
      // in one of ITS tabs (or windows), like any link.
      if (href && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return;
      e.preventDefault();
      if (interactive) onActivate();
    },
    // Middle-click closes, like a browser tab: `mousedown` turns off the
    // middle button's autoscroll, and `auxclick` keeps the browser from
    // opening the link in one of its tabs.
    onMouseDown: (e: MouseEvent<HTMLElement>) => {
      if (e.button === 1) e.preventDefault();
    },
    onAuxClick: (e: MouseEvent<HTMLElement>) => {
      if (e.button !== 1) return;
      e.preventDefault();
      // A pinned tab does not close on a stray click: only through the menu.
      if (interactive && !pinned) onClose?.();
    },
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === " ") {
        e.preventDefault();
        e.currentTarget.click();
      }
    },
    className: cn(
      "flex h-full min-w-0 flex-1 items-center gap-2 rounded-md pl-3 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset",
      // Without the X or the pin the name ends the tab: the right padding
      // matches the left, or the active underline (inset 8px) ends before the
      // text.
      noButton ? "pr-3" : "pr-1",
    ),
  } as const;
  const label = (
    <>
      {Icon && <Icon className="size-3.5 shrink-0 opacity-70" />}
      <span className="truncate">{title}</span>
    </>
  );

  const field = editing && (
    <NameField
      initial={title}
      maxLength={maxNameLength}
      onEnd={(name) => onEditEnd?.(name)}
      className={cn("ml-3", noButton ? "mr-3" : "mr-1")}
    />
  );

  const content = (
    <div
      ref={ref}
      data-tab={id}
      className={cn(
        // As wide as the name, with a ceiling: the strip scrolls, so the tab
        // does not shrink to fit; only a name past the ceiling truncates.
        "group/tab relative flex max-w-60 shrink-0 items-center text-[13px] transition-colors select-none",
        // The active tab is marked only by the underline on the strip's rule,
        // no box.
        active
          ? "font-medium text-foreground after:absolute after:bottom-0 after:left-2 after:right-2 after:h-0.5 after:rounded-t-full after:bg-basecast-brand"
          : "text-muted-foreground hover:text-foreground",
        dragging && "opacity-40",
      )}
    >
      {field ||
        (href ? (
          <Link href={href} {...tabProps}>
            {label}
          </Link>
        ) : (
          <button type="button" {...tabProps}>
            {label}
          </button>
        ))}
      {pinned ? (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Unpin ${title}`}
          title="Pinned tab: click to unpin"
          disabled={!interactive}
          onClick={onUnpin}
          className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pin className="size-3 -rotate-45" />
        </button>
      ) : (
        onClose && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Close ${title}`}
            title="Close tab"
            onClick={onClose}
            className={cn(
              "mr-1 flex size-5 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-muted hover:text-foreground",
              active ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover/tab:opacity-100",
            )}
          >
            <X className="size-3.5" />
          </button>
        )
      )}
      {edge && <DropIndicator edge={edge} gap="2px" />}
      {lastPinned && (
        <span className="absolute top-1/2 -right-px h-4 w-px -translate-y-1/2 bg-border" aria-hidden />
      )}
    </div>
  );

  if (!interactive || !menu) return content;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{content}</ContextMenuTrigger>
      <ContextMenuContent
        className="w-56"
        onCloseAutoFocus={(e) => {
          if (editingNow.current) e.preventDefault();
        }}
      >
        {menu}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function NameField({
  initial,
  maxLength,
  onEnd,
  className,
}: {
  initial: string;
  maxLength?: number;
  onEnd: (name: string | null) => void;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const ended = useRef(false);

  useEffect(() => {
    // One frame later: the context menu is still unmounting.
    const frame = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function end(name: string | null) {
    if (ended.current) return;
    ended.current = true;
    onEnd(name);
  }

  return (
    <input
      ref={ref}
      defaultValue={initial}
      maxLength={maxLength}
      aria-label="Tab name"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          end(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          end(null);
        }
      }}
      onBlur={(e) => end(e.currentTarget.value)}
      className={cn(
        "h-6 w-40 min-w-0 rounded-sm border bg-background px-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        className,
      )}
    />
  );
}
