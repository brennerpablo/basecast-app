import assert from "node:assert/strict";
import { test } from "node:test";

import { JSDOM } from "jsdom";

import { linkTarget } from "./link-target";

const ORIGIN = "https://basecast.example";

/** Builds the HTML and returns the element marked `id="target"`: where the
 *  right-click landed. */
function target(html: string): Element {
  const { document } = new JSDOM(`<!doctype html><body>${html}</body>`, { url: ORIGIN }).window;
  const el = document.getElementById("target");
  assert.ok(el, "the test HTML needs an id=target");
  return el;
}

test("an app link returns path, query and hash", () => {
  assert.equal(
    linkTarget(target('<a id="target" href="/accounts/42?tab=a#x">x</a>'), ORIGIN),
    "/accounts/42?tab=a#x",
  );
});

test("a click on the link's child counts as the link", () => {
  assert.equal(
    linkTarget(target('<a href="/accounts"><span><b id="target">Co-op</b></span></a>'), ORIGIN),
    "/accounts",
  );
});

test("an absolute URL of the same origin becomes a path", () => {
  assert.equal(linkTarget(target(`<a id="target" href="${ORIGIN}/forecast">x</a>`), ORIGIN), "/forecast");
});

test("target=_self still belongs to the window", () => {
  assert.equal(linkTarget(target('<a id="target" href="/data" target="_self">x</a>'), ORIGIN), "/data");
});

test("outside a link, nothing", () => {
  assert.equal(linkTarget(target('<button id="target">x</button>'), ORIGIN), null);
  assert.equal(linkTarget(null, ORIGIN), null);
});

test("another origin, mailto and tel stay with the browser", () => {
  for (const href of [
    "https://www.ercot.com/gridinfo",
    "https://other.basecast.example/",
    "mailto:team@basecast.example",
    "tel:+15125550100",
  ]) {
    assert.equal(linkTarget(target(`<a id="target" href="${href}">x</a>`), ORIGIN), null, href);
  }
});

test("a link that opens another window or downloads a file stays with the browser", () => {
  assert.equal(linkTarget(target('<a id="target" href="/data" target="_blank">x</a>'), ORIGIN), null);
  assert.equal(linkTarget(target('<a id="target" href="/export.csv" download>x</a>'), ORIGIN), null);
});

test("an API route is not a screen", () => {
  assert.equal(linkTarget(target('<a id="target" href="/api/accounts/export">x</a>'), ORIGIN), null);
  assert.equal(linkTarget(target('<a id="target" href="/api">x</a>'), ORIGIN), null);
  // A word prefix is not the `/api` folder.
  assert.equal(linkTarget(target('<a id="target" href="/apis">x</a>'), ORIGIN), "/apis");
});

test("an anchor on the same screen and an empty href stay with the browser", () => {
  assert.equal(linkTarget(target('<a id="target" href="#section">x</a>'), ORIGIN), null);
  assert.equal(linkTarget(target('<a id="target" href="">x</a>'), ORIGIN), null);
});

test("an open dropdown's item does not get a menu on top of a menu", () => {
  assert.equal(
    linkTarget(target('<div role="menu"><a id="target" role="menuitem" href="/accounts/1">View</a></div>'), ORIGIN),
    null,
  );
});

test("data-native-menu on the link or an ancestor is the explicit way out", () => {
  assert.equal(linkTarget(target('<a id="target" href="/accounts" data-native-menu>x</a>'), ORIGIN), null);
  assert.equal(
    linkTarget(target('<section data-native-menu><a id="target" href="/accounts">x</a></section>'), ORIGIN),
    null,
  );
});
