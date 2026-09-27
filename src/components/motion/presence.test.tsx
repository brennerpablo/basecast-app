/**
 * `usePresence` in JSDOM: a value shows at once, stays through its exit when it clears, then goes; a new value
 * while closing reopens at once.
 */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><div id=root></div>", { url: "http://localhost/" });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.IS_REACT_ACT_ENVIRONMENT = true;

const requireAfterDom = createRequire(__filename);
const React = requireAfterDom("react") as typeof import("react");
const { act } = React;
const { createRoot } = requireAfterDom("react-dom/client") as typeof import("react-dom/client");
const { usePresence } = requireAfterDom("./presence") as typeof import("./presence");

const EXIT = 30;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function Probe({ value }: { value: string | null }) {
  const { shown, closing } = usePresence(value, EXIT);
  return React.createElement("p", null, `${shown ?? "none"}|${closing ? "closing" : "steady"}`);
}

test("a panel value shows at once, stays through its exit, then goes; a new value reopens it", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const render = (value: string | null) => act(() => root.render(React.createElement(Probe, { value })));

  await render(null);
  assert.equal(container.textContent, "none|steady");
  await render("48091");
  assert.equal(container.textContent, "48091|steady");
  await render(null);
  assert.equal(container.textContent, "48091|closing");
  await act(() => wait(EXIT + 20));
  assert.equal(container.textContent, "none|steady");

  await render("48091");
  await render(null);
  await render("48029");
  assert.equal(container.textContent, "48029|steady");
  await act(() => wait(EXIT + 20));
  assert.equal(container.textContent, "48029|steady");

  act(() => root.unmount());
});
