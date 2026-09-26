/**
 * TS mirror of the `--basecast-brand-*` palette defined in `src/app/globals.css`.
 * Use `BRAND_CSS` at DOM/CSS runtime; `BRAND` where there is no CSS (SVG, exports).
 */

export const BRAND = {
  /** emerald-500 · main brand color */
  DEFAULT: "#10b981",
  /** emerald-600 · hover */
  HOVER: "#059669",
  FOREGROUND: "#ffffff",
  50: "#ecfdf5",
  100: "#d1fae5",
  700: "#047857",
  800: "#065f46",
} as const;

/** CSS references for React components (style/className through the Tailwind theme). */
export const BRAND_CSS = {
  brand: "var(--basecast-brand)",
  hover: "var(--basecast-brand-hover)",
  foreground: "var(--basecast-brand-foreground)",
  surface: "var(--basecast-brand-surface)",
  border: "var(--basecast-brand-border)",
  ring: "var(--basecast-brand-ring)",
  /** DataTable accent alias; points to brand. */
  dtAccent: "var(--dt-accent)",
} as const;
