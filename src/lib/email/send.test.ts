import assert from "node:assert/strict";
import { test } from "node:test";

import { type Email, EMAIL_FROM, type EmailClient, EmailError, sendEmailWith } from "./send";

const email: Email = { to: "jane@example.com", subject: "Hi", html: "<p>Hi</p>" };

test("sends from EMAIL_FROM and returns the Resend id", async () => {
  const sent: Parameters<EmailClient["emails"]["send"]>[0][] = [];
  const client: EmailClient = {
    emails: {
      send: async (payload) => {
        sent.push(payload);
        return { data: { id: "email-1" }, error: null, headers: null };
      },
    },
  };

  assert.equal(await sendEmailWith(client, email), "email-1");
  assert.deepEqual(sent, [{ ...email, from: EMAIL_FROM }]);
});

test("a refusal Resend resolves (not throws) becomes an EmailError", async () => {
  const client: EmailClient = {
    emails: {
      send: async () => ({
        data: null,
        error: { name: "validation_error", message: "Invalid `to` field.", statusCode: 422 },
        headers: null,
      }),
    },
  };

  await assert.rejects(sendEmailWith(client, email), (error: unknown) => {
    assert.ok(error instanceof EmailError);
    assert.equal(error.code, "validation_error");
    assert.equal(error.statusCode, 422);
    assert.equal(error.message, "Invalid `to` field.");
    return true;
  });
});
