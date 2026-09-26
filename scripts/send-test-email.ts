/**
 * Sends a sample notification in the BaseCast email layout, to check the key, the sending domain and
 * how the layout renders in a real inbox.
 *
 *   npm run email:test -- --to jane@example.com
 *
 * Needs RESEND_API_KEY (read from .env). The key only sends from basecast.pbrenner.com.
 */
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { parseArgs } from "node:util";

import { Resend } from "resend";

import { APP_URL, renderEmail } from "@/lib/email/layout";
import { EMAIL_FROM, sendEmailWith } from "@/lib/email/send";

const sentAt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Chicago",
  timeZoneName: "short",
});

async function main() {
  const { values } = parseArgs({ options: { to: { type: "string" } } });
  if (!values.to) throw new Error("--to: the address to send the test email to.");

  if (existsSync(".env.local")) loadEnvFile(".env.local");
  if (existsSync(".env")) loadEnvFile(".env");
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set (see .env.example).");

  const id = await sendEmailWith(new Resend(process.env.RESEND_API_KEY), {
    to: values.to,
    subject: "BaseCast test notification",
    ...renderEmail({
      preheader: "A sample of the standard BaseCast notification.",
      eyebrow: "Notification",
      heading: "This is a test notification",
      paragraphs: [
        "Every email BaseCast sends uses this layout: a heading that says what happened, a few lines on why it matters, the key facts, and one button to where you act on it.",
        "Nothing changed in your account. This email only checks that sending, the domain and the layout work.",
      ],
      details: [
        { label: "Sent at", value: sentAt.format(new Date()) },
        { label: "Sent by", value: "npm run email:test" },
        { label: "Sending domain", value: "basecast.pbrenner.com" },
      ],
      action: { label: "Open BaseCast", url: APP_URL },
      footnote: "You received this because someone ran the BaseCast email test with your address.",
    }),
  });
  console.log(`Sent from ${EMAIL_FROM} to ${values.to} (Resend id ${id}).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
