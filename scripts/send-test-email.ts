/**
 * Sends one test email through Resend, to check the key and the sending domain end to end.
 *
 *   npm run email:test -- --to jane@example.com
 *
 * Needs RESEND_API_KEY (read from .env). The key only sends from basecast.pbrenner.com, and Resend
 * refuses it until that domain's DNS records are verified.
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";

import { Resend } from "resend";

import { EMAIL_FROM, sendEmailWith } from "@/lib/email/send";

async function main() {
  const { values } = parseArgs({ options: { to: { type: "string" } } });
  if (!values.to) throw new Error("--to: the address to send the test email to.");

  if (existsSync(".env.local")) loadEnvFile(".env.local");
  if (existsSync(".env")) loadEnvFile(".env");
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set (see .env.example).");

  const sentAt = new Date().toISOString();
  const id = await sendEmailWith(new Resend(process.env.RESEND_API_KEY), {
    to: values.to,
    subject: "BaseCast test email",
    html: `<p>This is a test email from BaseCast, sent at ${sentAt} from <code>npm run email:test</code>.</p>`,
    text: `This is a test email from BaseCast, sent at ${sentAt} from npm run email:test.`,
  });
  console.log(`Sent from ${EMAIL_FROM} to ${values.to} (Resend id ${id}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
