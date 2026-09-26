// Shared Tailwind color palette used across components.
// All class strings are static so Tailwind v4 can scan them at build time.

export type PaletteColor =
  | "slate"
  | "blue"
  | "cyan"
  | "teal"
  | "emerald"
  | "green"
  | "indigo"
  | "violet"
  | "purple"
  | "pink"
  | "rose"
  | "red"
  | "orange"
  | "amber";

export const PALETTE_COLORS: PaletteColor[] = [
  "slate", "blue", "cyan", "teal", "emerald",
  "green", "indigo", "violet", "purple",
  "pink", "rose", "red", "orange", "amber",
];

/** Solid fill + matching border — used for checkbox/toggle active states. */
export const paletteCheckbox: Record<PaletteColor, string> = {
  slate:   "border-slate-500 bg-slate-500",
  blue:    "border-blue-500 bg-blue-500",
  cyan:    "border-cyan-500 bg-cyan-500",
  teal:    "border-teal-500 bg-teal-500",
  emerald: "border-emerald-500 bg-emerald-500",
  green:   "border-green-500 bg-green-500",
  indigo:  "border-indigo-500 bg-indigo-500",
  violet:  "border-violet-500 bg-violet-500",
  purple:  "border-purple-500 bg-purple-500",
  pink:    "border-pink-500 bg-pink-500",
  rose:    "border-rose-500 bg-rose-500",
  red:     "border-red-500 bg-red-500",
  orange:  "border-orange-500 bg-orange-500",
  amber:   "border-amber-500 bg-amber-500",
};

/** Single solid bg class — used for color swatches/dots. */
export const paletteDotBg: Record<PaletteColor, string> = {
  slate:   "bg-slate-500",
  blue:    "bg-blue-500",
  cyan:    "bg-cyan-500",
  teal:    "bg-teal-500",
  emerald: "bg-emerald-500",
  green:   "bg-green-500",
  indigo:  "bg-indigo-500",
  violet:  "bg-violet-500",
  purple:  "bg-purple-500",
  pink:    "bg-pink-500",
  rose:    "bg-rose-500",
  red:     "bg-red-500",
  orange:  "bg-orange-500",
  amber:   "bg-amber-500",
};

/** Light tinted background + darker text — used for chips/badges/tags. */
export const paletteChip: Record<PaletteColor, string> = {
  slate:   "bg-slate-100 text-slate-700",
  blue:    "bg-blue-50 text-blue-700",
  cyan:    "bg-cyan-50 text-cyan-700",
  teal:    "bg-teal-50 text-teal-700",
  emerald: "bg-emerald-50 text-emerald-700",
  green:   "bg-green-50 text-green-700",
  indigo:  "bg-indigo-50 text-indigo-700",
  violet:  "bg-violet-50 text-violet-700",
  purple:  "bg-purple-50 text-purple-700",
  pink:    "bg-pink-50 text-pink-700",
  rose:    "bg-rose-50 text-rose-700",
  red:     "bg-red-50 text-red-700",
  orange:  "bg-orange-50 text-orange-700",
  amber:   "bg-amber-50 text-amber-700",
};
