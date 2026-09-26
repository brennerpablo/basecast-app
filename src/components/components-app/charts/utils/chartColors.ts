export const CHART_COLORS = [
  "blue",
  "emerald",
  "red",
  "violet",
  "amber",
  "rose",
  "orange",
  "teal",
  "cyan",
  "pink",
  "indigo",
] as const

export type ChartColor = (typeof CHART_COLORS)[number]

/**
 * Hex alinhado à escala Tailwind `*-500` (mesma referência visual dos gráficos).
 */
export const CHART_COLOR_HEX: Record<ChartColor, string> = {
  blue: "#3b82f6",
  emerald: "#10b981",
  red: "#ef4444",
  violet: "#8b5cf6",
  amber: "#f59e0b",
  rose: "#f43f5e",
  orange: "#f97316",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  pink: "#ec4899",
  indigo: "#6366f1",
}

function isChartColorName(value: string): value is ChartColor {
  return (CHART_COLORS as readonly string[]).includes(value)
}

/** Normaliza `#rgb` / `#rrggbb` / `#rrggbbaa` para `#rrggbb` minúsculo. */
function normalizeHex6(hex: string): string {
  let h = hex.trim()
  if (!h.startsWith("#")) h = `#${h}`
  const body = h.slice(1)
  if (body.length === 3) {
    const e = body
      .split("")
      .map((c) => c + c)
      .join("")
    return `#${e.toLowerCase()}`
  }
  if (body.length === 6) {
    return `#${body.toLowerCase()}`
  }
  if (body.length === 8) {
    return `#${body.slice(0, 6).toLowerCase()}`
  }
  return h
}

/**
 * Cor CSS (`#rrggbb`) a partir de token de gráfico ou hex já válido.
 */
export function chartColorToCss(color: ChartColor | string): string {
  const s = typeof color === "string" ? color.trim() : color
  if (isHexColor(s)) {
    return normalizeHex6(s)
  }
  if (isChartColorName(s)) {
    return CHART_COLOR_HEX[s]
  }
  return CHART_COLOR_HEX.emerald
}

// Maps a color name to Tailwind utility classes for different SVG/CSS usages
const colorMap: Record<ChartColor, Record<"text" | "stroke" | "fill" | "bg", string>> = {
  blue:    { text: "text-blue-500",    stroke: "stroke-blue-500",    fill: "fill-blue-500",    bg: "bg-blue-500" },
  emerald: { text: "text-emerald-500", stroke: "stroke-emerald-500", fill: "fill-emerald-500", bg: "bg-emerald-500" },
  red:     { text: "text-red-500",     stroke: "stroke-red-500",     fill: "fill-red-500",     bg: "bg-red-500" },
  violet:  { text: "text-violet-500",  stroke: "stroke-violet-500",  fill: "fill-violet-500",  bg: "bg-violet-500" },
  amber:   { text: "text-amber-500",   stroke: "stroke-amber-500",   fill: "fill-amber-500",   bg: "bg-amber-500" },
  rose:    { text: "text-rose-500",    stroke: "stroke-rose-500",    fill: "fill-rose-500",    bg: "bg-rose-500" },
  orange:  { text: "text-orange-500",  stroke: "stroke-orange-500",  fill: "fill-orange-500",  bg: "bg-orange-500" },
  teal:    { text: "text-teal-500",    stroke: "stroke-teal-500",    fill: "fill-teal-500",    bg: "bg-teal-500" },
  cyan:    { text: "text-cyan-500",    stroke: "stroke-cyan-500",    fill: "fill-cyan-500",    bg: "bg-cyan-500" },
  pink:    { text: "text-pink-500",    stroke: "stroke-pink-500",    fill: "fill-pink-500",    bg: "bg-pink-500" },
  indigo:  { text: "text-indigo-500",  stroke: "stroke-indigo-500",  fill: "fill-indigo-500",  bg: "bg-indigo-500" },
}

export function getColorClass(
  color: ChartColor,
  variant: "text" | "stroke" | "fill" | "bg",
): string {
  return colorMap[color]?.[variant] ?? ""
}

export function isHexColor(color: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(color)
}

export function constructCategoryColors(
  categories: readonly string[],
  colors: readonly (ChartColor | string)[],
): Map<string, ChartColor | string> {
  const categoryColors = new Map<string, ChartColor | string>()
  categories.forEach((category, index) => {
    categoryColors.set(category, colors[index % colors.length])
  })
  return categoryColors
}
