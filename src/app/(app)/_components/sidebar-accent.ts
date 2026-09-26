/**
 * A menu item painted green (hover or active) IN DARK MODE.
 *
 * The item already normalizes its label and icon, but a badge inside it has
 * its own color, and in dark that color is TRANSLUCENT: the green shows through
 * the chip and the text, from the same color family, disappears. These classes
 * apply the same normalization to the chip.
 *
 * **Dark only, on purpose.** In light the chip is opaque and stays readable on
 * the green.
 *
 * The selector is `data-slot="badge"`, which `Badge` carries on its root. Both
 * constants are written out in full because Tailwind finds classes by READING
 * the file: building the prefix with a template literal would generate none.
 */

/** For the ACTIVE state, where the green is painted without hover. */
export const BADGE_ON_ACCENT =
  "dark:[&_[data-slot=badge]]:border-emerald-900/15 dark:[&_[data-slot=badge]]:bg-white/85 dark:[&_[data-slot=badge]]:text-emerald-900 dark:[&_[data-slot=badge]]:ring-emerald-900/15";

/** For the HOVER state. */
export const BADGE_ON_ACCENT_HOVER =
  "dark:hover:[&_[data-slot=badge]]:border-emerald-900/15 dark:hover:[&_[data-slot=badge]]:bg-white/85 dark:hover:[&_[data-slot=badge]]:text-emerald-900 dark:hover:[&_[data-slot=badge]]:ring-emerald-900/15";
