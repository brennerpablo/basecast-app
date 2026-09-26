import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * A screen tab bound to the URL must be a destination, like a sidebar item.
 *
 * The components-app `Tabs` only gets the right-click menu ("Open in new
 * tab", "Copy link") and Cmd/middle-click when it knows each tab's URL:
 * `urlParam` or `tabHref`. Forgetting the prop breaks nothing; the tab just
 * goes silent on right-click, and nobody notices. This test catches the
 * mechanical case (the `<Tabs>` `value` comes from `useQueryState` in the same
 * file) and requires the prop. Local-state tabs (no URL) stay out on purpose.
 */
test("a <Tabs> whose value comes from useQueryState declares urlParam or tabHref", () => {
  const files = execSync(`grep -rl "components-app/ui/tabs" src --include="*.tsx" || true`, {
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => f && !f.startsWith("src/components/components-app/ui/tabs"));

  const missing: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    const fromUrl = new Set(
      [
        ...source.matchAll(/const\s*\[\s*(\w+)\s*,\s*\w+\s*\]\s*=\s*useQueryState(?:<[^>]*>)?\(\s*"[\w-]+"/g),
      ].map((m) => m[1]),
    );
    for (const m of source.matchAll(/<Tabs\b([^>]*?)>/g)) {
      const attributes = m[1];
      const value = /\bvalue=\{\s*(\w+)/.exec(attributes)?.[1];
      if (!value || !fromUrl.has(value)) continue;
      if (!/\b(urlParam|tabHref)=/.test(attributes)) missing.push(`${file} (value={${value}})`);
    }
  }

  assert.deepEqual(
    missing,
    [],
    'pass urlParam="<param>" (or tabHref, if the tab switches routes); see "Same-window tabs" in CLAUDE.md',
  );
});

/**
 * The same rule for an UNCONTROLLED tab in a page's body: a section of the
 * screen, not a form or chart control (those live in other files). `urlParam`
 * puts the value in the URL (`TabsRootInUrl`) and the tab becomes a
 * destination. It applies to every PAGE file by name (`*page*`, `*client*`,
 * `*content*`); a component with another name stays out: it is a convention,
 * not a proof.
 */
test("a <Tabs defaultValue> in a page file declares urlParam", () => {
  const files = execSync(`grep -rlE "components-app/ui/tabs" src/app --include="*.tsx" || true`, {
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => /(page|client|content)\.tsx$/i.test(f));

  const missing: string[] = [];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(/<Tabs\b([^>]*?)>/g)) {
      const attributes = m[1];
      if (!/\bdefaultValue=/.test(attributes)) continue;
      if (!/\b(urlParam|tabHref)=/.test(attributes)) missing.push(file);
    }
  }

  assert.deepEqual(missing, [], 'pass urlParam="tab": the screen section becomes a destination');
});
