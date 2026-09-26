import assert from "node:assert/strict";
import { test } from "node:test";

import { type EmailContent, renderEmail } from "./layout";

const content: EmailContent = {
  preheader: "Preview line",
  eyebrow: "Notification",
  heading: "Forecast <updated>",
  paragraphs: ["North & South moved up.", "Second paragraph."],
  details: [{ label: "Account", value: "<b>North Co-op</b>" }],
  action: { label: "Open account", url: "https://basecast.pbrenner.com/accounts/1?a=1&b=2" },
  footnote: "You follow this account.",
};

test("escapes every piece of content in the HTML", () => {
  const { html } = renderEmail(content);

  assert.ok(html.includes("Forecast &lt;updated&gt;"));
  assert.ok(html.includes("North &amp; South moved up."));
  assert.ok(html.includes("&lt;b&gt;North Co-op&lt;/b&gt;"));
  assert.ok(html.includes('href="https://basecast.pbrenner.com/accounts/1?a=1&amp;b=2"'));
  assert.ok(!html.includes("<b>North Co-op</b>"));
  assert.ok(!html.includes("<updated>"));
});

test("the logo the HTML points at goes out as an inline attachment", () => {
  const { html, attachments } = renderEmail(content);
  const cid = /src="cid:([^"]+)"/.exec(html)?.[1];

  assert.ok(cid);
  assert.equal(attachments.length, 1);
  assert.equal(attachments[0].contentId, cid);
  assert.equal(attachments[0].contentType, "image/png");
  assert.ok(Buffer.from(attachments[0].content, "base64").subarray(1, 4).equals(Buffer.from("PNG")));
});

test("the text part carries the heading, body, facts and link, unescaped", () => {
  const { text } = renderEmail(content);

  for (const line of [
    "NOTIFICATION",
    "Forecast <updated>",
    "North & South moved up.",
    "Account: <b>North Co-op</b>",
    "Open account: https://basecast.pbrenner.com/accounts/1?a=1&b=2",
    "You follow this account.",
  ]) {
    assert.ok(text.includes(line), `missing: ${line}`);
  }
});

test("optional blocks are left out when not given", () => {
  const { html } = renderEmail({ heading: "Just a heading", paragraphs: [] });

  assert.ok(!html.includes("If the button does not open"));
  assert.ok(!html.includes("border-left:3px"));
  assert.ok(!html.includes("text-transform:uppercase"));
});
