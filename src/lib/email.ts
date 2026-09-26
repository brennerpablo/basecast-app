import "server-only";

import { Resend } from "resend";

import { type Email, sendEmailWith } from "@/lib/email/send";

export { type Email, EMAIL_FROM, EmailError } from "@/lib/email/send";

let client: Resend | undefined;

/**
 * Sends one email from `EMAIL_FROM` and returns its Resend id; rejects with `EmailError` when Resend
 * refuses it. The client is created on first use, never at import: `new Resend()` throws without
 * RESEND_API_KEY, and the build and pages that send nothing must not need it.
 */
export async function sendEmail(email: Email): Promise<string> {
  client ??= new Resend(process.env.RESEND_API_KEY);
  return sendEmailWith(client, email);
}
