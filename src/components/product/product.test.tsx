/**
 * The product components mounted in JSDOM: a null Fact is a gap and not a zero, the badges sit beside the
 * value, a card whose mart is not built shows the empty state with the mart's name, and a card with data
 * carries the response's caveats and provenance.
 *
 * `fetch` answers the caveat catalog, so the badges read their labels from it as in the app.
 */
/* eslint-disable react/no-children-prop -- DataCard's children is a render function, which createElement's child
   argument does not type. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { after, test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/", pretendToBeVisual: true });
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
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;

// `GET /caveats` is the bare catalog, not an envelope.
const CATALOG = {
  items: [
    { code: "simulated", label: "Simulated", text: "Comes from a simulated adapter." },
    { code: "machine_read_unverified", label: "Machine-read, not verified", text: "Read by machine." },
  ],
};
const realFetch = globalThis.fetch;
globalThis.fetch = (async () => new Response(JSON.stringify(CATALOG), { status: 200 })) as typeof fetch;
after(() => {
  globalThis.fetch = realFetch;
});

const requireAfterDom = createRequire(__filename);
const React = requireAfterDom("react") as typeof import("react");
const { act } = React;
const { createRoot } = requireAfterDom("react-dom/client") as typeof import("react-dom/client");
const { QueryClient, QueryClientProvider } = requireAfterDom(
  "@tanstack/react-query",
) as typeof import("@tanstack/react-query");
const { TooltipProvider } = requireAfterDom("@/components/ui/tooltip") as typeof import("@/components/ui/tooltip");
const { BffError } = requireAfterDom("@/lib/bff/envelope") as typeof import("@/lib/bff/envelope");
const { FactValue } = requireAfterDom("./fact-value") as typeof import("./fact-value");
const { DataCard } = requireAfterDom("./data-card") as typeof import("./data-card");

type QueryLike = import("@tanstack/react-query").UseQueryResult<import("@/lib/bff/envelope").Envelope<number[]>>;

async function mount(node: React.ReactNode): Promise<{ root: HTMLElement; unmount: () => void }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const root = createRoot(container);
  await act(async () => {
    root.render(
      React.createElement(
        QueryClientProvider,
        { client },
        React.createElement(TooltipProvider, null, node),
      ),
    );
  });
  // Let the catalog query settle.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  return {
    root: container,
    unmount: () => {
      act(() => root.unmount());
      container.remove();
      // Drops the queries and their garbage-collection timers, which would keep the process alive.
      client.clear();
    },
  };
}

test("a null Fact is a gap, not a zero, and its badges sit beside it", async () => {
  const { root, unmount } = await mount(
    React.createElement(FactValue, {
      fact: { value: null, unit: "MW", label: "4CP load", note: "Private data", simulated: true, verified: false },
    }),
  );
  const value = root.querySelector("[data-gap]");
  assert.ok(value, "the value is marked as a gap");
  assert.equal(value.textContent, "—");
  assert.ok(!root.textContent?.includes("0 MW"));
  const badges = [...root.querySelectorAll("[data-caveat]")].map((b) => b.textContent);
  assert.deepEqual(badges, ["Simulated", "Machine-read, not verified"]);
  unmount();
});

test("a public, verified Fact carries no badge", async () => {
  const { root, unmount } = await mount(
    React.createElement(FactValue, { fact: { value: 91_134, unit: "MW", simulated: false, verified: true } }),
  );
  assert.equal(root.textContent, "91.1 GW");
  assert.equal(root.querySelectorAll("[data-caveat]").length, 0);
  unmount();
});

test("a card whose mart is not built shows the empty state with the mart's name", async () => {
  const query = { data: undefined, error: new BffError("x", 503, "mart_accounts") } as unknown as QueryLike;
  const { root, unmount } = await mount(
    React.createElement(DataCard<number[]>, { title: "Accounts", query, children: () => "body" }),
  );
  assert.match(root.textContent ?? "", /This view is being rebuilt/);
  assert.match(root.textContent ?? "", /mart_accounts/);
  assert.ok(!root.textContent?.includes("body"));
  unmount();
});

test("a card with data shows its caveats and its provenance", async () => {
  const query = {
    data: {
      data: [1, 2],
      meta: {
        generated_at: "2026-09-26T18:00:00Z",
        data_as_of: "2026-09-01",
        model_version: "9c62100.1",
        simulated: false,
        verified: true,
        sources: ["ERCOT"],
        caveats: [{ code: "band_uncalibrated", label: "Band not calibrated", text: "Not calibrated." }],
      },
    },
    error: null,
  } as unknown as QueryLike;
  const { root, unmount } = await mount(
    React.createElement(DataCard<number[]>, { title: "Peak", query, children: (data) => `rows ${data.length}` }),
  );
  assert.match(root.textContent ?? "", /rows 2/);
  assert.equal(root.querySelector("[data-caveat]")?.textContent, "Band not calibrated");
  const provenance = root.querySelector("[data-slot=provenance]")?.textContent ?? "";
  assert.match(provenance, /Source: ERCOT/);
  assert.match(provenance, /Data as of: Sep 1, 2026/);
  assert.match(provenance, /Model: 9c62100\.1/);
  unmount();
});
