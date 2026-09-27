/**
 * The Explorer's map colors, from the dataviz reference palette: the first three categorical slots (the ones
 * validated all-pairs, as a choropleth needs) for the acquisition channels, the one-hue blue ramp for
 * magnitudes, blue ↔ red with a grey midpoint for signed changes. Dark mode has its own steps.
 */

export type Mode = "light" | "dark";

export const SURFACE: Record<Mode, string> = { light: "#fcfcfb", dark: "#1a1a19" };
/** Counties with no value in the layer (inside ERCOT). */
export const NO_DATA: Record<Mode, string> = { light: "#e1e0d9", dark: "#2c2c2a" };
/** Counties outside ERCOT, under the hatch. */
export const OUTSIDE: Record<Mode, string> = { light: "#f0efec", dark: "#262624" };
export const HATCH: Record<Mode, string> = { light: "#c3c2b7", dark: "#4a4a46" };
export const BORDER: Record<Mode, string> = { light: "#ffffff", dark: "#1a1a19" };
export const ZONE_LINE: Record<Mode, string> = { light: "#52514e", dark: "#c3c2b7" };
export const HIGHLIGHT: Record<Mode, string> = { light: "#0b0b0b", dark: "#ffffff" };

export type Channel = "retail_direct" | "partnership" | "mixed";

/** Categorical slots 1–3: blue, orange, aqua. */
export const CHANNEL_HUE: Record<Channel, Record<Mode, string>> = {
  retail_direct: { light: "#2a78d6", dark: "#3987e5" },
  partnership: { light: "#eb6834", dark: "#d95926" },
  mixed: { light: "#1baf7a", dark: "#199e70" },
};

/** The one-hue blue ramp, low to high: toward the surface for low values in both modes. */
export const SEQUENTIAL: Record<Mode, string[]> = {
  light: ["#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  dark: ["#0d366b", "#184f95", "#256abf", "#2a78d6", "#5598e7", "#86b6ef", "#b7d3f6"],
};

/** Blue ↔ red: three steps a side and the grey midpoint, most negative first. */
export const DIVERGING: Record<Mode, string[]> = {
  light: ["#b12f2e", "#e34948", "#f0a3a2", "#f0efec", "#9ec5f4", "#3987e5", "#184f95"],
  dark: ["#e66767", "#b84444", "#6e3232", "#383835", "#1c4a82", "#3987e5", "#86b6ef"],
};

function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `from` → `to` at `t` (0–1), in sRGB. */
export function mix(from: string, to: string, t: number): string {
  const a = rgb(from);
  const b = rgb(to);
  return `#${a
    .map((v, i) => Math.round(v + (b[i] - v) * t))
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** How far toward the channel's hue each priority class goes (class 1 = lowest, 5 = top). */
const CLASS_STRENGTH = [0.22, 0.4, 0.58, 0.78, 1];

/** A channel's hue at a priority class: the class sets the lightness, from near the surface to the full hue. */
export function channelColor(channel: Channel, priorityClass: number, mode: Mode): string {
  const i = Math.min(CLASS_STRENGTH.length, Math.max(1, Math.round(priorityClass))) - 1;
  return mix(SURFACE[mode], CHANNEL_HUE[channel][mode], CLASS_STRENGTH[i]);
}
