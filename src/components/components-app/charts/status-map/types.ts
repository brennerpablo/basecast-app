import type React from "react"

export type StatusMapEntry = {
  row: string     // row label (e.g. machine name)
  date: string    // ISO "YYYY-MM-DD"
  status: string
}

export type StatusItemConfig = {
  color: string        // Tailwind class, e.g. "bg-emerald-500"
  label: string        // Human-readable label
  enableAction?: boolean  // If true, clicking this status cell triggers onAction
}

/** `auto`: linha de mês só quando o eixo cobre 2+ meses. */
export type StatusMapDateHeader = "auto" | "day-only" | "month-and-day"

export type StatusMapProps = {
  data: StatusMapEntry[]
  labelConfig: Record<string, StatusItemConfig>
  /** Cabeçalho temporal das colunas; padrão `auto`. */
  dateHeader?: StatusMapDateHeader
  style?: "rounded" | "squared" | "tight"
  bordered?: boolean
  label?: boolean
  labelAlign?: "left" | "center" | "right"
  labelTop?: boolean
  showZeroCounts?: boolean
  rowHeaderWidth?: number | string
  /** Posição inicial da rolagem horizontal; padrão `start`. */
  initialScroll?: "start" | "end"
  className?: string
  onCellClick?: (row: string, date: string, status: string) => void
  onAction?: (row: string, date: string, status: string) => void
  tooltip?: boolean
  tooltipContent?: (row: string, date: string, status: string, label: string) => React.ReactNode
  /**
   * A small badge drawn over a cell —
   * the IA icon on a desenquadrado day that has (or is getting) an analysis.
   * Return null for no badge.
   */
  cellBadge?: (row: string, date: string, status: string) => React.ReactNode
}
