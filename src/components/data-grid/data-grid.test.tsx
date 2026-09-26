/**
 * The grid mounted in JSDOM: headers, virtualized rows, link cells as real
 * anchors, alignment/monospace, the status bar, and a column menu that only
 * offers sorting where the column allows it.
 *
 * JSDOM has no layout, so the scroll container is given a size through
 * `offsetWidth/offsetHeight` (what the virtualizer reads first) and
 * `ResizeObserver` is a no-op. `next/link` is replaced by a plain anchor that
 * records its props: what is under test is that the grid renders a `Link` for
 * an app path, not Next's router.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id=root></div>", {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.IS_REACT_ACT_ENVIRONMENT = true;
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (key in g) continue;
  try {
    g[key] = (dom.window as unknown as Record<string, unknown>)[key];
  } catch {
    // Getters that throw outside a real browser; irrelevant here.
  }
}
// Node has its own Event/CustomEvent, which the copy above skips; Radix
// dispatches them on JSDOM nodes, and JSDOM only accepts its own.
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
class NoopResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
g.ResizeObserver = NoopResizeObserver;
(dom.window as unknown as Record<string, unknown>).ResizeObserver = NoopResizeObserver;
for (const [prop, value] of [
  ["offsetHeight", 600],
  ["offsetWidth", 1000],
] as const) {
  Object.defineProperty(dom.window.HTMLElement.prototype, prop, {
    configurable: true,
    get: () => value,
  });
}

const requireAfterDom = createRequire(__filename);

function stubModule(specifier: string, exports: Record<string, unknown>): void {
  const id = requireAfterDom.resolve(specifier);
  requireAfterDom.cache[id] = { id, filename: id, loaded: true, exports } as unknown as NodeJS.Module;
}

const React = requireAfterDom("react") as typeof import("react");
const { act } = React;
const { createRoot } = requireAfterDom("react-dom/client") as typeof import("react-dom/client");

/** Every `<Link>` the grid rendered, by href. */
const links = new Map<string, Record<string, unknown>>();
function FakeLink({ href, prefetch, ...rest }: { href: string; prefetch?: boolean } & Record<string, unknown>) {
  links.set(href, { prefetch });
  return React.createElement("a", { href, "data-next-link": "", ...rest });
}
stubModule("next/link", { __esModule: true, default: FakeLink });
stubModule("@/components/tabs/link-menu", {
  LinkMenuItems: ({ href }: { href: string }) => React.createElement("div", { "data-link-items": href }),
});
// Imports a compiled .css file, which Node cannot load.
stubModule("@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box", { DropIndicator: () => null });

const grid = requireAfterDom("./index") as typeof import("./index");
const { DataGrid, defaultColumnState, spreadsheetColumnName } = grid;

type Row = { id: string; name: string; mw: number; code: string; doc: string };

const ROWS: Row[] = Array.from({ length: 3 }, (_, i) => ({
  id: `q${i}`,
  name: `Project ${i}`,
  mw: (i + 1) * 1000.5,
  code: `INR-${i}`,
  doc: `https://example.com/doc/${i}`,
}));

const COLUMNS: import("./index").GridColumn<Row>[] = [
  {
    id: "name",
    title: "Project",
    type: "text",
    width: 180,
    sortable: true,
    action: { href: (r) => `/data/queue/${r.id}` },
  },
  { id: "mw", title: "MW", type: "number", width: 100, format: (v) => Number(v).toLocaleString("en-US") },
  { id: "code", title: "Code", type: "text", width: 100, mono: true, sortable: false },
  {
    id: "doc",
    title: "Source",
    type: "text",
    width: 60,
    pinned: "right",
    action: { icon: () => React.createElement("svg"), label: "Open source", href: (r) => r.doc },
  },
];

async function render(element: React.ReactElement) {
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => root.render(element));
  return {
    container,
    unmount: () => act(() => root.unmount()),
  };
}

function Sheet({ onViewport }: { onViewport?: (a: number, b: number) => void }) {
  const [columnState, setColumnState] = React.useState(() => defaultColumnState(COLUMNS));
  const [sorting, setSorting] = React.useState<import("./index").GridSortState>(null);
  const [filters, setFilters] = React.useState<import("./index").GridFilterState>({});
  return React.createElement(DataGrid<Row>, {
    columns: COLUMNS,
    columnState,
    onColumnStateChange: setColumnState,
    rowCount: ROWS.length,
    totalCount: 1234,
    getRow: (i: number) => ROWS[i],
    onViewportChange: onViewport ?? (() => {}),
    sorting,
    onSortingChange: setSorting,
    filters,
    onFiltersChange: setFilters,
    toolbar: {},
    className: "h-[600px]",
  });
}

test("renders headers, rows, alignment, monospace and the status bar", async () => {
  const viewports: [number, number][] = [];
  const { container, unmount } = await render(
    React.createElement(Sheet, { onViewport: (a, b) => viewports.push([a, b]) }),
  );
  try {
    const headers = [...container.querySelectorAll("[data-grid-header-col]")].map((h) => h.textContent);
    assert.deepEqual(headers, ["Project", "MW", "Code"]);
    assert.equal(container.querySelectorAll("[data-grid-gutter]").length, 3);

    const cell = (r: number, c: number) =>
      container.querySelector<HTMLElement>(`[data-grid-cell][data-r="${r}"][data-c="${c}"]`);
    assert.equal(cell(1, 1)?.textContent, "2,001");
    assert.match(cell(1, 1)?.className ?? "", /justify-end/);
    assert.match(cell(1, 1)?.className ?? "", /tabular-nums/);
    assert.match(cell(1, 2)?.className ?? "", /font-mono/);
    assert.doesNotMatch(cell(1, 0)?.className ?? "", /font-mono/);

    assert.match(container.textContent ?? "", /1,234 rows/);
    assert.deepEqual(viewports.at(-1), [0, 2]);
  } finally {
    unmount();
  }
});

test("an app path is a Next Link in the same tab; a URL opens a new tab", async () => {
  links.clear();
  const { container, unmount } = await render(React.createElement(Sheet));
  try {
    const appLink = container.querySelector<HTMLAnchorElement>('a[href="/data/queue/q1"]');
    assert.ok(appLink, "the name cell links to its detail");
    assert.equal(appLink.textContent, "Project 1");
    assert.ok(appLink.hasAttribute("data-grid-cell-action"));
    assert.ok(appLink.hasAttribute("data-next-link"));
    assert.equal(appLink.getAttribute("target"), null);
    assert.equal(links.get("/data/queue/q1")?.prefetch, false);
    // Still a grid cell: selectable and copyable.
    assert.ok(appLink.closest("[data-grid-cell]"));

    const external = container.querySelector<HTMLAnchorElement>('a[href="https://example.com/doc/1"]');
    assert.ok(external, "the pinned icon links out");
    assert.equal(external.getAttribute("target"), "_blank");
    assert.equal(external.getAttribute("aria-label"), "Open source");
    assert.equal(external.hasAttribute("data-next-link"), false);
    // The pinned lane is display-only.
    assert.equal(external.closest("[data-grid-cell]"), null);
  } finally {
    unmount();
  }
});

test("the column menu offers sorting only on sortable columns", async () => {
  const { container, unmount } = await render(React.createElement(Sheet));
  const doc = dom.window.document;
  const openMenu = async (title: string) => {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="Menu for column ${title}"]`);
    assert.ok(button, `menu button for ${title}`);
    await act(async () => button.click());
  };
  const closeMenu = async () => {
    await act(async () => {
      doc.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    // Radix returns focus to the trigger on a timer after closing; a menu
    // opened before it fires would read that focus as "outside" and close.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  };
  try {
    await openMenu("Project");
    assert.match(doc.body.textContent ?? "", /Sort ascending/);
    assert.match(doc.body.textContent ?? "", /Freeze up to this column/);
    await closeMenu();

    await openMenu("Code");
    assert.doesNotMatch(doc.body.textContent ?? "", /Sort ascending/);
    assert.match(doc.body.textContent ?? "", /Freeze up to this column/);
    await closeMenu();
  } finally {
    unmount();
  }
});

test("a mouse selection feeds the status bar, and Ctrl+C copies raw values", async () => {
  let copied: string | null = null;
  Object.defineProperty(globalThis.navigator, "clipboard", {
    configurable: true,
    value: {
      // No ClipboardItem in JSDOM: the grid falls back to plain text.
      write: async () => {
        throw new Error("unsupported");
      },
      writeText: async (text: string) => {
        copied = text;
      },
    },
  });
  const { container, unmount } = await render(React.createElement(Sheet));
  const win = dom.window;
  const cell = (r: number, c: number) =>
    container.querySelector<HTMLElement>(`[data-grid-cell][data-r="${r}"][data-c="${c}"] span`);
  const click = async (target: Element | null, shiftKey = false) => {
    assert.ok(target);
    await act(async () => {
      target.dispatchEvent(new win.MouseEvent("mousedown", { bubbles: true, button: 0, shiftKey }));
      win.dispatchEvent(new win.MouseEvent("mouseup", { bubbles: true, button: 0 }));
    });
  };
  try {
    await click(cell(1, 1));
    await click(cell(2, 1), true);
    const status = container.textContent ?? "";
    assert.match(status, /2 cells · sum 5,002.5 · avg 2,501.25 · min 2,001 · max 3,001.5/);

    const sheet = container.querySelector('[role="grid"]');
    assert.ok(sheet);
    await act(async () => {
      sheet.dispatchEvent(new win.KeyboardEvent("keydown", { key: "c", ctrlKey: true, bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    assert.equal(copied, "2001\n3001.5");
  } finally {
    unmount();
  }
});

test("right-clicking an app link offers the link items; an external one keeps the browser menu", async () => {
  const { container, unmount } = await render(React.createElement(Sheet));
  const win = dom.window;
  const doc = win.document;
  const rightClick = async (target: Element | null) => {
    assert.ok(target);
    const event = new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
    await act(async () => {
      target.dispatchEvent(event);
    });
    return event;
  };
  try {
    const external = await rightClick(container.querySelector('a[href="https://example.com/doc/1"]'));
    assert.equal(external.defaultPrevented, false, "the browser menu stays");
    assert.equal(doc.querySelector("[data-link-items]"), null);

    const app = await rightClick(container.querySelector('a[href="/data/queue/q1"]'));
    assert.equal(app.defaultPrevented, true, "the grid menu takes over");
    assert.equal(doc.querySelector("[data-link-items]")?.getAttribute("data-link-items"), "/data/queue/q1");
    assert.match(doc.body.textContent ?? "", /Copy/);
  } finally {
    unmount();
  }
});

test("positional columns are named like a spreadsheet", () => {
  assert.deepEqual([0, 1, 26].map(spreadsheetColumnName), ["A", "B", "AA"]);
});
