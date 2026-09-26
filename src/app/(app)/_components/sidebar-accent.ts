/**
 * A menu item painted with the brand color (hover or active) IN DARK MODE.
 *
 * The item already normalizes its label and icon, but a badge inside it has
 * its own color, and in dark that color is TRANSLUCENT: the brand shows through
 * the chip and a text of the same color family disappears. These classes give
 * the chip an opaque face with the brand's ink (`brand-foreground`).
 *
 * **Dark only, on purpose.** In light the chip is opaque and stays readable on
 * the brand.
 *
 * The selector is `data-slot="badge"`, which `Badge` carries on its root. Both
 * constants are written out in full because Tailwind finds classes by READING
 * the file: building the prefix with a template literal would generate none.
 */

/** For the ACTIVE state, where the brand is painted without hover. */
export const BADGE_ON_ACCENT =
  "dark:[&_[data-slot=badge]]:border-brand-foreground/15 dark:[&_[data-slot=badge]]:bg-white/85 dark:[&_[data-slot=badge]]:text-brand-foreground dark:[&_[data-slot=badge]]:ring-brand-foreground/15";

/** For the HOVER state. */
export const BADGE_ON_ACCENT_HOVER =
  "dark:hover:[&_[data-slot=badge]]:border-brand-foreground/15 dark:hover:[&_[data-slot=badge]]:bg-white/85 dark:hover:[&_[data-slot=badge]]:text-brand-foreground dark:hover:[&_[data-slot=badge]]:ring-brand-foreground/15";
