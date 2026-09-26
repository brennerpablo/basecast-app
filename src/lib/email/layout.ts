// The one layout every BaseCast email uses, after the Fundsys and Upstate emails: a forest band with the
// logo, a lime rule, then heading, body, key facts and one button on a white card over the canvas cream.
// Tables and inline styles only, so Gmail, Apple Mail and Outlook render it alike. No `server-only`:
// `scripts/send-test-email.ts` renders it too.

import { BRAND } from "@/lib/brand-tokens";
import { EMAIL_LOGO_HEIGHT, EMAIL_LOGO_PNG_BASE64, EMAIL_LOGO_WIDTH } from "@/lib/email/logo";
import type { EmailAttachment } from "@/lib/email/send";

/** Links in emails are opened from an inbox, so they always point at production. */
export const APP_URL = "https://basecast.pbrenner.com";

/** Light-mode tokens from `src/app/globals.css` (Base Power's colors), as hex. */
const COLOR = {
  /** `--canvas`, Base's surface-default. */
  canvas: "#f0eeeb",
  /** `--card`. */
  card: "#ffffff",
  /** `--foreground`, Base's text-default. */
  text: "#292826",
  /** `--muted-foreground`, Base's grey-80. */
  muted: "#54524f",
  /** `--border`, Base's border-default. */
  border: "#d8d7d5",
  /** `--basecast-brand`, the forest ink. */
  forest: BRAND.DEFAULT,
  /** `--brand-foreground`, the ink on the lime fill. */
  forestDark: BRAND.HOVER,
  /** `--brand`, the lime fill. */
  lime: BRAND[100],
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const LOGO_CID = "basecast-logo";
/** Display height; the PNG is twice that for high-density screens. */
const LOGO_HEIGHT = EMAIL_LOGO_HEIGHT / 2;
const LOGO_WIDTH = EMAIL_LOGO_WIDTH / 2;

export interface EmailContent {
  /** The inbox preview line; hidden in the body. */
  preheader?: string;
  /** Small uppercase label above the heading, e.g. "Notification". */
  eyebrow?: string;
  heading: string;
  /** Body paragraphs, plain text: the layout escapes them. */
  paragraphs: string[];
  /** Key facts under the body, one row each. */
  details?: { label: string; value: string }[];
  /** The one button. Its URL is also printed below it, for clients that block buttons. */
  action?: { label: string; url: string };
  /** Why the recipient got this email; above the footer. */
  footnote?: string;
}

export interface RenderedEmail {
  html: string;
  text: string;
  attachments: EmailAttachment[];
}

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function renderDetails(details: NonNullable<EmailContent["details"]>): string {
  const rows = details
    .map(
      ({ label, value }) => `
                      <tr>
                        <td valign="top" style="padding:4px 16px 4px 0;width:140px;font-family:${FONT};font-size:13px;line-height:1.5;color:${COLOR.muted};">${escapeHtml(label)}</td>
                        <td valign="top" style="padding:4px 0;font-family:${FONT};font-size:13px;line-height:1.5;font-weight:600;color:${COLOR.text};">${escapeHtml(value)}</td>
                      </tr>`,
    )
    .join("");
  return `
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;border-collapse:separate;">
                  <tr>
                    <td style="padding:12px 16px;border:1px solid ${COLOR.border};border-left:3px solid ${COLOR.forest};border-radius:10px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}
                      </table>
                    </td>
                  </tr>
                </table>`;
}

function renderAction({ label, url }: NonNullable<EmailContent["action"]>): string {
  const href = escapeHtml(url);
  return `
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;">
                  <tr>
                    <td align="center" bgcolor="${COLOR.lime}" style="border-radius:8px;">
                      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:15px;font-weight:600;line-height:1;color:${COLOR.forestDark};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:16px 0 0;font-family:${FONT};font-size:12px;line-height:1.5;color:${COLOR.muted};">
                  If the button does not open, copy this address into your browser:<br />
                  <a href="${href}" target="_blank" style="color:${COLOR.forest};word-break:break-all;">${href}</a>
                </p>`;
}

function renderText(content: EmailContent): string {
  const lines = ["BASECAST", ""];
  if (content.eyebrow) lines.push(content.eyebrow.toUpperCase());
  lines.push(content.heading, "");
  for (const paragraph of content.paragraphs) lines.push(paragraph, "");
  if (content.details?.length) {
    for (const { label, value } of content.details) lines.push(`${label}: ${value}`);
    lines.push("");
  }
  if (content.action) lines.push(`${content.action.label}: ${content.action.url}`, "");
  if (content.footnote) lines.push(content.footnote, "");
  lines.push("--", "BaseCast", APP_URL);
  return lines.join("\n");
}

/**
 * Renders `content` in the BaseCast layout. `attachments` carries the inline logo that the HTML points at
 * (`cid:`), so it must go out with the email.
 */
export function renderEmail(content: EmailContent): RenderedEmail {
  const { preheader, eyebrow, heading, paragraphs, details, action, footnote } = content;

  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${COLOR.canvas};opacity:0;">${escapeHtml(preheader)}</div>`
    : "";
  const eyebrowBlock = eyebrow
    ? `<p style="margin:0 0 8px;font-family:${FONT};font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${COLOR.forest};">${escapeHtml(eyebrow)}</p>`
    : "";
  const body = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.6;color:${COLOR.text};">${escapeHtml(paragraph)}</p>`,
    )
    .join("\n                ");
  const footnoteBlock = footnote
    ? `<p style="margin:0 0 14px;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLOR.muted};">${escapeHtml(footnote)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(heading)}</title>
    <style>
      @media (max-width: 620px) {
        .bc-pad { padding-left: 24px !important; padding-right: 24px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background-color:${COLOR.canvas};-webkit-font-smoothing:antialiased;">
    ${preheaderBlock}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COLOR.canvas}" style="background-color:${COLOR.canvas};">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background-color:${COLOR.card};border:1px solid ${COLOR.border};border-radius:16px;overflow:hidden;">
            <tr>
              <td class="bc-pad" bgcolor="${COLOR.forest}" style="background-color:${COLOR.forest};padding:28px 40px;">
                <img src="cid:${LOGO_CID}" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="BaseCast" style="display:block;width:${LOGO_WIDTH}px;height:${LOGO_HEIGHT}px;border:0;outline:none;text-decoration:none;" />
              </td>
            </tr>
            <tr>
              <td bgcolor="${COLOR.lime}" style="height:4px;line-height:4px;font-size:4px;background-color:${COLOR.lime};">&nbsp;</td>
            </tr>
            <tr>
              <td class="bc-pad" style="padding:36px 40px 8px;">
                ${eyebrowBlock}
                <h1 style="margin:0 0 18px;font-family:${FONT};font-size:22px;line-height:1.3;font-weight:700;color:${COLOR.text};">${escapeHtml(heading)}</h1>
                ${body}
                ${details?.length ? renderDetails(details) : ""}
                ${action ? renderAction(action) : ""}
              </td>
            </tr>
            <tr>
              <td class="bc-pad" style="padding:28px 40px 32px;">
                <hr style="border:none;border-top:1px solid ${COLOR.border};margin:0 0 20px;" />
                ${footnoteBlock}
                <p style="margin:0 0 4px;font-family:${FONT};font-size:13px;line-height:1.6;font-weight:600;color:${COLOR.text};">BaseCast</p>
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${COLOR.muted};">
                  Sent from noreply@basecast.pbrenner.com, which does not receive replies.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-family:${FONT};font-size:11px;line-height:1.5;color:${COLOR.muted};">
            <a href="${APP_URL}" target="_blank" style="color:${COLOR.muted};text-decoration:none;">basecast.pbrenner.com</a>
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>
`;

  return {
    html,
    text: renderText(content),
    attachments: [
      {
        filename: "basecast-logo.png",
        content: EMAIL_LOGO_PNG_BASE64,
        contentType: "image/png",
        contentId: LOGO_CID,
      },
    ],
  };
}
