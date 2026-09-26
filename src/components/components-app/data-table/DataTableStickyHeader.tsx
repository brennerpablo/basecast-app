"use client";

import * as React from "react";
import ReactDOM from "react-dom";

import { Table, TableHeader } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * Floating clone of the table header, shown while the real header is scrolled
 * out of the viewport.
 *
 * Why a clone instead of `position: sticky` on the real `<thead>`: the table is
 * wrapped in an `overflow-x-auto` container (and the shadcn `<Table>` adds a
 * second `overflow-auto` div). A sticky element resolves against its nearest
 * scroll container, and those containers never scroll vertically — so the real
 * header would stay glued to a box that is itself moving off screen, i.e. it
 * would do nothing. The clone is `position: fixed`, portaled to `document.body`
 * so no `overflow-hidden` ancestor can clip it, and mirrors the container's
 * horizontal scroll offset so the columns stay aligned on wide tables.
 */

/** Don't bother floating the header when this little of the body is left. */
const MIN_VISIBLE_BODY_PX = 48;

/**
 * Breathing room between the top of the scroll viewport and the floating bar.
 * Matches the app shell's `<main className="p-4">` inset, so the bar lines up
 * with where page content normally starts. Override with `offsetTop`.
 */
const DEFAULT_TOP_GAP_PX = 16;

/** Kept in sync with the `duration-150` on the exit animation below. */
const EXIT_MS = 150;

type Geometry = {
  top: number;
  /** Content box of the scroller — the bar aligns to the table's own edges. */
  left: number;
  width: number;
  /**
   * Border box of the whole table container. The mask band uses this: the
   * container's left/right borders run its full height, so a band clipped to
   * the content box leaves them showing as vertical lines in the gap.
   */
  coverLeft: number;
  coverWidth: number;
  scrollLeft: number;
  tableWidth: number;
};

/** Hides subpixel seams between the mask band and the container's border. */
const COVER_BLEED_PX = 1;

/**
 * Nearest ancestor that actually scrolls vertically. In the app shell that is
 * `<main className="overflow-auto">`; in DataTable fullscreen it is the portal's
 * own flex column. `null` means the window scrolls, so the boundary is y = 0.
 * The `scrollHeight > clientHeight` test is what keeps the table's own
 * `overflow-auto` wrappers from being picked (they never overflow vertically).
 */
function getVerticalScrollParent(el: HTMLElement): HTMLElement | null {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

/**
 * The element that actually scrolls sideways. `<Table>` wraps the `<table>` in
 * its own `overflow-auto` div, so on wide tables that inner div takes the
 * horizontal scroll and the outer `overflow-x-auto` container stays at
 * `scrollLeft: 0` — reading the outer one would leave the clone misaligned.
 */
function getHorizontalScroller(
  tableEl: HTMLTableElement,
  container: HTMLElement,
): HTMLElement {
  let node: HTMLElement | null = tableEl.parentElement;
  while (node) {
    if (node.scrollWidth > node.clientWidth + 1) return node;
    if (node === container) break;
    node = node.parentElement;
  }
  return container;
}

/**
 * The colour the real header composites against: the first fully opaque
 * background above the table.
 *
 * The header row is translucent (`bg-muted/50`), so the clone only matches if
 * it sits on the *same* surface — and a hardcoded `bg-card` is a guess about
 * where the table was mounted. Measuring it holds for cards, dialogs, nested
 * panels and fullscreen alike. Translucent layers in between are skipped rather
 * than composited, which is still strictly closer than assuming a token.
 */
function readSurfaceColor(el: HTMLElement): string | null {
  let node: HTMLElement | null = el;
  while (node) {
    const color = window.getComputedStyle(node).backgroundColor;
    const alpha = color.startsWith("rgba(")
      ? Number.parseFloat(color.slice(color.lastIndexOf(",") + 1))
      : color === "transparent"
        ? 0
        : 1;
    if (alpha === 1) return color;
    node = node.parentElement;
  }
  return null;
}

function readColumnWidths(headEl: HTMLTableSectionElement): number[] {
  const rows = headEl.rows;
  const lastRow = rows[rows.length - 1];
  if (!lastRow) return [];
  return Array.from(lastRow.cells).map((cell) => cell.getBoundingClientRect().width);
}

interface DataTableStickyHeaderProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  tableRef: React.RefObject<HTMLTableElement | null>;
  headerRef: React.RefObject<HTMLTableSectionElement | null>;
  /** Same class the in-flow `<TableHeader>` gets, so ghost tables stay borderless. */
  headerClassName?: string;
  /** Inherited CSS custom properties (`--dt-accent`) — the portal escapes the wrapper. */
  style?: React.CSSProperties;
  /** Above the fullscreen overlay (z-60) when the table is fullscreen. */
  zIndex?: number;
  /** Gap in px between the top of the scroll viewport and the floating bar. */
  offsetTop?: number;
  /**
   * Whether the floating header's sort controls act on the table. When false the
   * bar is labels-only — the sort arrows still show the current sort, they just
   * can't be clicked.
   */
  sortable?: boolean;
  /**
   * Background of the floating panel. Must match the surface the table sits on
   * — `bg-card` inside the app shell's Card, `bg-background` fullscreen — since
   * it stands in for that surface everywhere it covers.
   */
  surfaceClassName?: string;
  /** The `<TableRow>`s of the real header — same nodes, so sorting works here too. */
  children: React.ReactNode;
}

export function DataTableStickyHeader({
  containerRef,
  tableRef,
  headerRef,
  headerClassName,
  style,
  zIndex = 30,
  offsetTop = DEFAULT_TOP_GAP_PX,
  sortable = true,
  surfaceClassName = "bg-card",
  children,
}: DataTableStickyHeaderProps) {
  const [geometry, setGeometry] = React.useState<Geometry | null>(null);
  const [colWidths, setColWidths] = React.useState<number[]>([]);
  const [surfaceColor, setSurfaceColor] = React.useState<string | null>(null);
  // The bar keeps its last geometry while fading out, then unmounts.
  const [exiting, setExiting] = React.useState(false);

  React.useEffect(() => {
    const container = containerRef.current;
    const tableEl = tableRef.current;
    const headEl = headerRef.current;
    if (!container || !tableEl || !headEl) return;

    let frame = 0;
    // Vertical scrolling leaves every tracked value untouched, so the geometry
    // key stays identical and no state update (or width re-measure) happens —
    // the rAF body is then just three getBoundingClientRect calls per frame.
    let lastKey = "";
    let shown = false;
    let exitTimer = 0;

    const measure = () => {
      frame = 0;
      const scrollParent = getVerticalScrollParent(container);
      const restingTop =
        (scrollParent ? scrollParent.getBoundingClientRect().top : 0) + offsetTop;
      const scroller = getHorizontalScroller(tableEl, container);
      const headRect = headEl.getBoundingClientRect();
      const tableRect = tableEl.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      // Not the same element as `scroller` when the table overflows sideways:
      // then the scroller is shadcn's inner div, which sits inside the
      // container's border.
      const containerRect =
        scroller === container ? scrollerRect : container.getBoundingClientRect();

      const show =
        scrollerRect.width > 0 &&
        headRect.top < restingTop &&
        tableRect.bottom > restingTop + headRect.height + MIN_VISIBLE_BODY_PX;

      if (!show) {
        lastKey = "";
        if (shown && !exitTimer) {
          setExiting(true);
          exitTimer = window.setTimeout(() => {
            exitTimer = 0;
            shown = false;
            setExiting(false);
            setGeometry(null);
          }, EXIT_MS);
        }
        return;
      }

      // Scrolled back into range mid-fade: cancel the exit, keep it on screen.
      if (exitTimer) {
        window.clearTimeout(exitTimer);
        exitTimer = 0;
        setExiting(false);
      }
      shown = true;

      const next: Geometry = {
        top: restingTop,
        // Content box, not border box. `getBoundingClientRect()` includes the
        // container's 1px border (`bordered` tables) and any vertical
        // scrollbar, which is what made the bar overhang the table by a pixel
        // on each side. `clientLeft` is the left border width and `clientWidth`
        // excludes both — together they land exactly on the table's own edges,
        // so the hairline ring falls on top of the container's border instead
        // of beside it.
        left: scrollerRect.left + scroller.clientLeft,
        width: scroller.clientWidth,
        coverLeft: containerRect.left - COVER_BLEED_PX,
        coverWidth: containerRect.width + COVER_BLEED_PX * 2,
        scrollLeft: scroller.scrollLeft,
        tableWidth: tableEl.offsetWidth,
      };
      const key = `${next.top}|${next.left}|${next.width}|${next.coverLeft}|${next.coverWidth}|${next.scrollLeft}|${next.tableWidth}`;
      if (key === lastKey) return;
      lastKey = key;
      setGeometry(next);
      setColWidths(readColumnWidths(headEl));
      // Same cadence as the column widths: only when the geometry key moves,
      // never on a plain vertical scroll frame — getComputedStyle isn't free.
      setSurfaceColor(readSurfaceColor(container));
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    // Capture phase: the scroller is an ancestor `<main>`, not the window, and
    // scroll events don't bubble.
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    observer.observe(tableEl);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (exitTimer) window.clearTimeout(exitTimer);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, [containerRef, tableRef, headerRef, offsetTop]);

  // Never render on incomplete geometry. A fixed panel whose `left`/`width`
  // resolve to undefined or NaN doesn't fail quietly — it falls back to its
  // static position, which for a portal into <body> means a full-width slab
  // parked at the top-left corner, over the sidebar. Bailing out costs a
  // missing sticky header for a frame; the alternative is that slab.
  const geometryIsUsable =
    geometry != null &&
    [
      geometry.top,
      geometry.left,
      geometry.width,
      geometry.coverLeft,
      geometry.coverWidth,
      geometry.tableWidth,
    ].every((value) => Number.isFinite(value));

  if (!geometryIsUsable) return null;

  return ReactDOM.createPortal(
    // One opaque surface owns the whole floating region: the gap above the bar,
    // the table container's own left/right borders (they run its full height,
    // so any narrower mask leaves them showing as vertical lines), and the area
    // behind the bar's rounded corners. Masking those separately is what kept
    // producing a new seam each time one was fixed — nothing here is layered
    // over live table content, so there is nothing left to leak through.
    <div
      data-datatable-sticky-header=""
      className={cn(
        "fixed",
        surfaceClassName,
        exiting
          ? "animate-out fade-out-0 slide-out-to-top-1 duration-150"
          : "animate-in fade-in-0 slide-in-from-top-1 duration-200",
      )}
      style={{
        ...style,
        top: geometry.top - offsetTop,
        left: geometry.coverLeft,
        width: geometry.coverWidth,
        paddingTop: offsetTop,
        // Measured surface wins; `surfaceClassName` is the fallback for the
        // first paint and for anything with no opaque ancestor at all.
        ...(surfaceColor ? { backgroundColor: surfaceColor } : {}),
        zIndex,
      }}
    >
      {/* The bar itself, inset back onto the scroller's content box so its
          columns line up with the table. Height is left to the content — no
          measurement to drift out of sync with the real header. */}
      <div
        // `inert` takes the duplicated sort buttons out of the tab order and
        // the accessibility tree — the real header already exposes them.
        inert={!sortable || undefined}
        className={cn(
          "overflow-hidden rounded-t-md",
          // A hairline ring instead of a real border: `border` would shrink the
          // content box by 1px on each side and throw the columns out of
          // alignment with the table underneath. The ring is drawn outside layout.
          "shadow-[0_0_0_1px_hsl(var(--border)),0_6px_16px_-6px_rgb(0_0_0/0.18)]",
          // Hide the arrows, and neutralise the trigger rather than the bar: a
          // `pointer-events-none` bar would let the click fall through to the
          // row hidden underneath, which on a selectable table silently toggles
          // a row you can't see. Killed here it lands on the bar and does
          // nothing. `inert` alone would cover it, but this keeps the affordance
          // (cursor, hover tint) honest too.
          !sortable && [
            "**:data-sort-indicator:hidden",
            "**:data-sort-trigger:pointer-events-none",
            "**:data-sort-trigger:cursor-default",
            "**:data-sort-trigger:hover:bg-transparent",
          ],
        )}
        style={{
          marginLeft: geometry.left - geometry.coverLeft,
          width: geometry.width,
        }}
      >
        {/* Colunas congeladas (`sticky left-0` / `right-0`) não funcionam aqui:
            o clone não rola, ele é transladado — para o `position: sticky` o
            scrollLeft é sempre 0, então a célula viaja junto com a translação
            em vez de ficar presa na borda. Devolvemos o deslocamento só nessas
            células, o que as recoloca sobre as do corpo. À esquerda basta
            desfazer a translação; à direita a célula tem de pousar na borda do
            container, que fica a `tableWidth - width` de distância. */}
        <style>{
          "[data-dt-sticky-clone] th.sticky{transform:translateX(var(--dt-clone-scroll,0px))}" +
          "[data-dt-sticky-clone] th.sticky.right-0{transform:translateX(var(--dt-clone-scroll-right,0px))}"
        }</style>
        <div
          data-dt-sticky-clone=""
          style={
            {
              width: geometry.tableWidth,
              transform: `translateX(${-geometry.scrollLeft}px)`,
              "--dt-clone-scroll": `${geometry.scrollLeft}px`,
              "--dt-clone-scroll-right": `${
                geometry.width - geometry.tableWidth + geometry.scrollLeft
              }px`,
            } as React.CSSProperties
          }
        >
          <Table
            // O clone não rola: o wrapper e a `<table>` têm exatamente
            // `geometry.tableWidth`. `overflow-hidden` garante que a
            // `grid-scrollbar` do primitivo não desenhe uma segunda barra
            // dentro da barra flutuante.
            containerClassName="overflow-hidden"
            className={cn("w-full caption-bottom text-sm")}
            style={{ tableLayout: "fixed", width: geometry.tableWidth }}
          >
            <colgroup>
              {colWidths.map((width, index) => (
                <col key={index} style={{ width }} />
              ))}
            </colgroup>
            {/* The row keeps its own `bg-muted/50` — over the opaque surface
                behind it that reproduces the real header exactly. Only the top
                border goes, since it would cut a straight line across the
                rounded corners. */}
            <TableHeader className={cn(headerClassName, "[&>tr]:border-t-0")}>
              {children}
            </TableHeader>
          </Table>
        </div>
      </div>
    </div>,
    document.body,
  );
}
