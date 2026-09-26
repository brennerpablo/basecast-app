import type React from "react"

// --- Language ---

export type EditableGridLanguage = "en" | "pt"

// --- Cell types ---

export type CellType = "text" | "number" | "date" | "select" | "checkbox" | "textarea"

// --- Options (for select columns) ---

export type OptionItem = { value: string; label: string }

// --- Validation ---

export type ValidationRule<TData = Record<string, unknown>> = {
  required?: boolean
  min?: number
  max?: number
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  custom?: (value: unknown, row: TData) => string | null
}

// --- Column definition ---

export type EditableColumnDef<TData = Record<string, unknown>> = {
  columnId: keyof TData & string
  title: string
  type: CellType
  width?: number | string
  readonly?: boolean
  options?: OptionItem[]
  validation?: ValidationRule<TData>
  placeholder?: string
  formatter?: (value: unknown, row: TData) => React.ReactNode
  aligned?: "left" | "center" | "right"
  sortable?: boolean
}

// --- Active cell state ---

export type ActiveCell = {
  rowId: string | number
  columnId: string
  draftValue: unknown
  originalValue: unknown
}

// --- Component props ---

export type EditableGridProps<TData extends Record<string, unknown>> = {
  columns: EditableColumnDef<TData>[]
  data: TData[]
  rowIdKey: keyof TData & string
  onCellChange?: (rowId: string | number, columnId: string, newValue: unknown) => void
  onRowChange?: (rowId: string | number, updatedRow: TData) => void
  onAddRow?: () => void
  onDeleteRows?: (rowIds: (string | number)[]) => void
  /** Fires whenever the selected rows change (selection itself stays internal). */
  onSelectionChange?: (rowIds: (string | number)[]) => void
  enableAddRow?: boolean
  enableDeleteRow?: boolean
  enableRowSelection?: boolean
  language?: EditableGridLanguage
  bordered?: boolean
  compact?: boolean
  accentColor?: string
  /** Stick the header row to the top when scrolling vertically. Default: true */
  stickyHeader?: boolean
  /** Always show scrollbars instead of auto-hiding them. Default: false */
  alwaysShowScrollbars?: boolean
  /** Number of leading columns to freeze (stick to the left when scrolling horizontally). Default: 0 */
  stickyColumns?: number
  className?: string
}
