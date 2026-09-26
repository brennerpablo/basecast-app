/**
 * The block window over a paged route: which blocks go out, with which
 * params, and where their rows land.
 *
 * Pure helpers first; then the hook itself, rendered in JSDOM against a real
 * QueryClient and a fake `fetch` that plays the route (echoing offset/limit,
 * `total` only on the summary block).
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { JSDOM } from "jsdom";

import {
  blocksForViewport,
  blockUrl,
  lastUsefulBlock,
} from "./use-grid-window-query";

test("a viewport needs its blocks, the one before, and the next when close", () => {
  // Top of the sheet, far from block 1's start (lookahead is half a block).
  assert.deepEqual(blocksForViewport(0, 30, 500, 199), [0]);
  // The last visible row is within 250 rows of block 1.
  assert.deepEqual(blocksForViewport(0, 260, 500, 199), [0, 1]);
  // Deep: the block before, the viewport's, and block 0 (it carries the total).
  assert.deepEqual(blocksForViewport(1200, 1240, 500, 199), [0, 1, 2]);
  assert.deepEqual(blocksForViewport(5100, 5140, 500, 199), [0, 9, 10]);
  // Never past the window's last block.
  assert.deepEqual(blocksForViewport(99_900, 99_990, 500, 199), [0, 198, 199]);
});

test("block URLs carry offset/limit, and withSummary on block 0 only", () => {
  assert.equal(
    blockUrl("/api/data/rows", 0, 500, "dir=asc&sort=mw"),
    "/api/data/rows?offset=0&limit=500&withSummary=1&dir=asc&sort=mw",
  );
  assert.equal(blockUrl("/api/data/rows", 3, 500, ""), "/api/data/rows?offset=1500&limit=500");
  // A route that already has a querystring.
  assert.equal(
    blockUrl("/api/data/rows?table=queue", 1, 200, "q=solar"),
    "/api/data/rows?table=queue&offset=200&limit=200&q=solar",
  );
});

test("the total decides the last block worth asking for", () => {
  assert.equal(lastUsefulBlock(undefined, 500), 0);
  assert.equal(lastUsefulBlock(0, 500), 0);
  assert.equal(lastUsefulBlock(500, 500), 0);
  assert.equal(lastUsefulBlock(501, 500), 1);
  assert.equal(lastUsefulBlock(1200, 500), 2);
});

// --- the hook, rendered -----------------------------------------------------

const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
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

const requireAfterDom = createRequire(__filename);
const React = requireAfterDom("react") as typeof import("react");
const { act } = React;
const { createRoot } = requireAfterDom("react-dom/client") as typeof import("react-dom/client");
const { QueryClient, QueryClientProvider } = requireAfterDom(
  "@tanstack/react-query",
) as typeof import("@tanstack/react-query");
const { fetchGridExportRows, useGridWindowQuery } = requireAfterDom(
  "./use-grid-window-query",
) as typeof import("./use-grid-window-query");

type Row = { id: number };
type Result = ReturnType<typeof useGridWindowQuery<Row>>;

/** The fake route: `total` rows numbered 0..total-1. */
function fakeRoute(total: number, requests: URL[]) {
  return async (input: string | URL) => {
    const url = new URL(String(input), "http://localhost/");
    requests.push(url);
    const offset = Number(url.searchParams.get("offset"));
    const limit = Number(url.searchParams.get("limit"));
    const rows: Row[] = [];
    for (let i = offset; i < Math.min(total, offset + limit); i++) rows.push({ id: i });
    const body = {
      rows,
      offset,
      limit,
      generatedAt: "2026-09-26T12:00:00Z",
      ...(url.searchParams.get("withSummary") === "1" ? { total, summary: { count: total } } : {}),
    };
    return { ok: true, status: 200, json: async () => body } as Response;
  };
}

async function settle() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mount(opts: { total: number; paramsQs?: string; maxWindow?: number }) {
  const requests: URL[] = [];
  g.fetch = fakeRoute(opts.total, requests);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const latest: { current: Result | null } = { current: null };
  let paramsQs = opts.paramsQs ?? "";
  function Probe({ qs }: { qs: string }) {
    latest.current = useGridWindowQuery<Row>({
      apiUrl: "/api/rows",
      queryKey: ["rows"],
      paramsQs: qs,
      blockSize: 500,
      maxWindow: opts.maxWindow,
    });
    return null;
  }
  const container = dom.window.document.createElement("div");
  dom.window.document.body.appendChild(container);
  const root = createRoot(container);
  const render = async () => {
    await act(async () =>
      root.render(
        React.createElement(
          QueryClientProvider,
          { client },
          React.createElement(Probe, { qs: paramsQs }),
        ),
      ),
    );
    await settle();
  };
  await render();
  return {
    requests,
    get result() {
      assert.ok(latest.current);
      return latest.current;
    },
    async viewport(start: number, end: number) {
      await act(async () => latest.current?.onViewportChange(start, end));
      await settle();
    },
    async setParams(qs: string) {
      paramsQs = qs;
      await render();
    },
    unmount() {
      act(() => root.unmount());
      client.clear();
    },
  };
}

const offsets = (requests: URL[]) =>
  requests.map((u) => `${u.searchParams.get("offset")}${u.searchParams.has("withSummary") ? "+summary" : ""}`);

test("block 0 alone goes out first, and it carries the total", async () => {
  const grid = await mount({ total: 1200, paramsQs: "dir=asc&sort=id" });
  try {
    assert.deepEqual(offsets(grid.requests), ["0+summary"]);
    assert.equal(grid.requests[0].searchParams.get("sort"), "id");
    assert.equal(grid.result.rowCount, 1200);
    assert.equal(grid.result.totalCount, 1200);
    assert.deepEqual(grid.result.summary, { count: 1200 });
    assert.equal(grid.result.generatedAt, "2026-09-26T12:00:00Z");
    assert.deepEqual(grid.result.getRow(499), { id: 499 });
    assert.equal(grid.result.getRow(500), undefined);
  } finally {
    grid.unmount();
  }
});

test("scrolling brings the next blocks, without the summary", async () => {
  const grid = await mount({ total: 1200 });
  try {
    await grid.viewport(0, 30);
    assert.deepEqual(offsets(grid.requests), ["0+summary"]);
    await grid.viewport(560, 600);
    await grid.viewport(1100, 1150);
    assert.deepEqual(offsets(grid.requests), ["0+summary", "500", "1000"]);
    assert.deepEqual(grid.result.getRow(600), { id: 600 });
    assert.deepEqual(grid.result.getRow(1199), { id: 1199 });
    assert.equal(grid.result.getRow(1200), undefined);
  } finally {
    grid.unmount();
  }
});

test("no block past the total is ever asked for", async () => {
  const grid = await mount({ total: 400 });
  try {
    // The lookahead would want block 1, but block 0 said there are 400 rows.
    await grid.viewport(0, 399);
    assert.deepEqual(offsets(grid.requests), ["0+summary"]);
    assert.equal(grid.result.rowCount, 400);
  } finally {
    grid.unmount();
  }
});

test("the browsable window is capped; the total is not", async () => {
  const grid = await mount({ total: 250_000, maxWindow: 100_000 });
  try {
    assert.equal(grid.result.rowCount, 100_000);
    assert.equal(grid.result.totalCount, 250_000);
    // The grid always reports the top first (mount), then the scroll.
    await grid.viewport(0, 30);
    await grid.viewport(99_950, 99_999);
    // Blocks 198 and 199 at most — never 200 (offset 100,000).
    assert.deepEqual(offsets(grid.requests), ["0+summary", "99000", "99500"]);
  } finally {
    grid.unmount();
  }
});

test("a new sort/filter restarts from block 0, ignoring the stale deep viewport", async () => {
  const grid = await mount({ total: 6000, paramsQs: "dir=asc&sort=id" });
  try {
    await grid.viewport(0, 30);
    await grid.viewport(5100, 5150);
    assert.deepEqual(offsets(grid.requests), ["0+summary", "4500", "5000"]);
    grid.requests.length = 0;
    await grid.setParams("dir=desc&sort=id");
    assert.deepEqual(offsets(grid.requests), ["0+summary"]);
    assert.equal(grid.requests[0].searchParams.get("dir"), "desc");
    // The grid reports the old scroll position once more before snapping to
    // the top: it must not pull deep blocks for the new key.
    await grid.viewport(5100, 5150);
    assert.deepEqual(offsets(grid.requests), ["0+summary"]);
    await grid.viewport(0, 30);
    await grid.viewport(5100, 5150);
    assert.deepEqual(offsets(grid.requests), ["0+summary", "4500", "5000"]);
  } finally {
    grid.unmount();
  }
});

test("export pages through the same route, up to the cap", async () => {
  const requests: URL[] = [];
  g.fetch = fakeRoute(12_000, requests);
  const progress: [number, number][] = [];
  const rows = await fetchGridExportRows<Row>({
    apiUrl: "/api/rows",
    paramsQs: "dir=asc&sort=id",
    totalCount: 12_000,
    blockSize: 5_000,
    onProgress: (done, total) => progress.push([done, total]),
  });
  assert.equal(rows.length, 12_000);
  assert.deepEqual(rows.at(-1), { id: 11_999 });
  assert.deepEqual(offsets(requests), ["0", "5000", "10000"]);
  assert.equal(requests[1].searchParams.get("sort"), "id");
  assert.deepEqual(progress, [[1, 3], [2, 3], [3, 3]]);

  requests.length = 0;
  const capped = await fetchGridExportRows<Row>({
    apiUrl: "/api/rows",
    paramsQs: "",
    totalCount: 12_000,
    cap: 7_000,
    blockSize: 5_000,
  });
  assert.equal(capped.length, 7_000);
  assert.deepEqual(offsets(requests), ["0", "5000"]);
});

test("export stops at the first short block when the total is unknown", async () => {
  const requests: URL[] = [];
  g.fetch = fakeRoute(6_200, requests);
  const rows = await fetchGridExportRows<Row>({ apiUrl: "/api/rows", paramsQs: "", blockSize: 5_000 });
  assert.equal(rows.length, 6_200);
  assert.deepEqual(offsets(requests), ["0", "5000"]);
});
