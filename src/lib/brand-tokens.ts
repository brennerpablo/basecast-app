/**
 * TS mirror of the `--basecast-brand-*` palette defined in `src/app/globals.css`
 * (light values): the brand INK, Base Power's forest greens. The lime FILL is
 * `--brand` (`bg-brand`), which has no hex mirror because it is only used
 * through Tailwind. Use `BRAND_CSS` at DOM/CSS runtime; `BRAND` where there is
 * no CSS (SVG, exports).
 */

export const BRAND = {
  /** Base green-90 (text-brand / text-link) · main ink color */
  DEFAULT: "#1e4d2b",
  /** Base green-100 · hover */
  HOVER: "#102a17",
  FOREGROUND: "#ffffff",
  /** Base green-5 (brand-primary-subtle) */
  50: "#d6f0b4",
  /** Base green-20 (brand-primary, the lime) */
  100: "#b2dd79",
  700: "#1e4d2b",
  800: "#102a17",
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
