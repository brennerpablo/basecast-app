/**
 * Chart colors for the product screens, from the dataviz reference palette: categorical slots in their
 * fixed order (never cycled), chart ink for text, axes and grid, each with its own dark-mode step.
 */

export type ChartMode = "light" | "dark";

/** Categorical slots 1–3 (blue, orange, aqua): validated all-pairs, so they also work as dots and areas. */
export const SERIES: Record<ChartMode, [string, string, string]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a"],
  dark: ["#3987e5", "#d95926", "#199e70"],
};

export const INK: Record<ChartMode, { primary: string; secondary: string; muted: string; grid: string; axis: string }> = {
  light: { primary: "#0b0b0b", secondary: "#52514e", muted: "#898781", grid: "#e1e0d9", axis: "#c3c2b7" },
  dark: { primary: "#ffffff", secondary: "#c3c2b7", muted: "#898781", grid: "#2c2c2a", axis: "#383835" },
};

/** Axis ticks in GW (charts read in GW; tables keep the MW rule): whole numbers bare, others with one decimal. */
export const gwTick = (mw: number) => {
  const gw = mw / 1_000;
  return `${Number.isInteger(Math.round(gw * 10) / 10) ? gw.toFixed(0) : gw.toFixed(1)} GW`;
};
