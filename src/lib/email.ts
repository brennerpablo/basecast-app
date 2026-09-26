import "server-only";

import { Resend } from "resend";

import { type EmailContent, renderEmail } from "@/lib/email/layout";
import { sendEmailWith } from "@/lib/email/send";

export { APP_URL, type EmailContent } from "@/lib/email/layout";
export { EMAIL_FROM, EmailError } from "@/lib/email/send";

let client: Resend | undefined;

export interface EmailMessage extends EmailContent {
  to: string | string[];
  subject: string;
  replyTo?: string | string[];
}

/**
 * Sends one email in the BaseCast layout (`src/lib/email/layout.ts`) from `EMAIL_FROM` and returns its
 * Resend id; rejects with `EmailError` when Resend refuses it. There is no raw-HTML path on purpose:
 * every email the app sends looks the same. The client is created on first use, never at import:
 * `new Resend()` throws without RESEND_API_KEY, and the build and pages that send nothing must not need it.
 */
export async function sendEmail({ to, subject, replyTo, ...content }: EmailMessage): Promise<string> {
  client ??= new Resend(process.env.RESEND_API_KEY);
  return sendEmailWith(client, { to, subject, replyTo, ...renderEmail(content) });
}
