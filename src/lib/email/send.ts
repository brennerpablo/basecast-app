// Shared by the app (`src/lib/email.ts`) and `scripts/send-test-email.ts`. No `server-only` here: the
// script runs outside Next.

import type { CreateEmailResponse } from "resend";

/** The app's only sender: its Resend key (`RESEND_API_KEY`) can only send from this domain. */
export const EMAIL_FROM = "BaseCast <noreply@basecast.pbrenner.com>";

export interface Email {
  to: string | string[];
  subject: string;
  html: string;
  /** Plain-text part, for clients that do not render HTML. */
  text?: string;
  replyTo?: string | string[];
}

/** The part of the Resend client this module uses, so a test can pass a stand-in. */
export interface EmailClient {
  emails: {
    send(payload: Email & { from: string }): Promise<CreateEmailResponse>;
  };
}

/** Resend refused the email (bad address, unverified domain, quota, invalid key). */
export class EmailError extends Error {
  constructor(
    message: string,
    /** Resend's error code, e.g. `validation_error`. */
    readonly code: string,
    readonly statusCode: number | null,
  ) {
    super(message);
    this.name = "EmailError";
  }
}

/**
 * Sends one email from `EMAIL_FROM` and returns its Resend id. `emails.send` resolves `{ data, error }`
 * instead of throwing, so a caller that only wraps it in `try/catch` counts a refused email as sent (the
 * Fundsys app paid for this); here the error throws.
 */
export async function sendEmailWith(client: EmailClient, email: Email): Promise<string> {
  const { data, error } = await client.emails.send({ ...email, from: EMAIL_FROM });
  if (error) throw new EmailError(error.message, error.name, error.statusCode);
  return data.id;
}
