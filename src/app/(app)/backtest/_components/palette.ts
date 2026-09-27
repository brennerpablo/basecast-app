/**
 * The backtest charts' colors, from the dataviz reference palette (the same instance the Explorer map uses).
 * Categorical slots 1–3 in fixed order: basecast blue, LTLF orange, CDR aqua (validated all-pairs against
 * the app's light, Zinc and Deep surfaces). The actual is ink, the ablation and the raw queue are grey
 * context. The vintage matrix is blue ↔ red with a grey midpoint. Dark mode has its own steps.
 */

import type { Family } from "./backtest-data";

export type Mode = "light" | "dark";

export const SERIES: Record<Family, Record<Mode, string>> = {
  basecast: { light: "#2a78d6", dark: "#3987e5" },
  LTLF: { light: "#eb6834", dark: "#d95926" },
  CDR: { light: "#1baf7a", dark: "#199e70" },
  organic: { light: "#898781", dark: "#898781" },
  other: { light: "#898781", dark: "#898781" },
};

/** The actual peak and the built MW: secondary ink, never a series hue. */
export const ACTUAL: Record<Mode, string> = { light: "#52514e", dark: "#c3c2b7" };
/** Context bars (the raw queue, the developers' dates): two greys a step apart. */
export const CONTEXT: Record<Mode, [string, string]> = {
  light: ["#c3c2b7", "#898781"],
  dark: ["#52514e", "#898781"],
};

/**
 * The matrix's diverging scale, three steps an arm from the midpoint out: under-forecast in blue,
 * over-forecast in red. In dark mode the strong step is the one furthest from the dark surface.
 */
export const DIVERGING: Record<Mode, { mid: string; under: string[]; over: string[] }> = {
  light: {
    mid: "#f0efec",
    under: ["#9ec5f4", "#3987e5", "#184f95"],
    over: ["#f0a3a2", "#e34948", "#b12f2e"],
  },
  dark: {
    mid: "#383835",
    under: ["#1c4a82", "#3987e5", "#86b6ef"],
    over: ["#6e3232", "#b84444", "#e66767"],
  },
};

/** The fill of a signed error bin (see `errorBin`). */
export function binFill(bin: number, mode: Mode): string {
  const scale = DIVERGING[mode];
  if (bin === 0) return scale.mid;
  return (bin < 0 ? scale.under : scale.over)[Math.min(3, Math.abs(bin)) - 1];
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  const channel = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** Ink or white on a fill, whichever contrasts more (a label inside a colored cell). */
export function inkOn(fill: string): string {
  const l = luminance(fill);
  const onWhite = 1.05 / (l + 0.05);
  const onInk = (l + 0.05) / 0.05;
  return onInk >= onWhite ? "#0b0b0b" : "#ffffff";
}
