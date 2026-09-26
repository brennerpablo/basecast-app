"use client"

import {
  type CellContext,
  ColumnDef,
  FilterFn,
  type HeaderContext,
  Row,
  type VisibilityState,
} from "@tanstack/react-table"
import Link from "next/link"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

import { DataTableColumnHeader } from "./DataTableColumnHeader"
import type { ConditionFilter, DateRangeFilter, PercentageRangeFilter } from "./DataTableFilter"
import type { ColumnLinkVariant, ColumnMetadata } from "./types"

export function buildDefaultColumnVisibility<TData>(
  metadata: readonly ColumnMetadata<TData>[] | undefined,
): VisibilityState {
  if (!metadata?.length) return {};
  const visibility: VisibilityState = {};
  for (const col of metadata) {
    if (col.defaultVisible === false && !col.filterOnly) {
      visibility[col.columnId] = false;
    }
  }
  return visibility;
}

/**
 * Label dictionary for `inferOptions`. The values offered by an inferred filter
 * always come from the data — never from this map — so a value the caller did
 * not foresee (a legacy spelling, a new enum member) still gets an entry and no
 * row becomes unfilterable. Declared `options` only supply the display label;
 * anything missing falls back to the raw value, which is what the column showed
 * before a dictionary was passed.
 */
export function buildOptionLabelLookup<TData>(
  col: ColumnMetadata<TData>,
): (value: string) => string {
  if (!col.options?.length) return (value) => value;
  const labels = new Map(col.options.map((o) => [o.value, o.label]));
  return (value) => labels.get(value) ?? value;
}

export const percentageRangeFilterFn: FilterFn<unknown> = (
  row: Row<unknown>,
  columnId: string,
  filterValue: PercentageRangeFilter,
) => {
  const value = row.getValue(columnId) as number
  const [min, max] = filterValue
  return value >= min && value <= max
}

export const numberConditionFilterFn: FilterFn<unknown> = (
  row: Row<unknown>,
  columnId: string,
  filterValue: ConditionFilter,
) => {
  const value = row.getValue(columnId) as number
  const [min, max] = filterValue.value as [number, number]

  switch (filterValue.condition) {
    case "is-equal-to":
      return value == min
    case "is-between":
      return value >= min && value <= max
    case "is-greater-than":
      return value > min
    case "is-less-than":
      return value < min
    default:
      return true
  }
}

export function parseDateValue(raw: unknown): Date | null {
  if (raw instanceof Date) return raw
  if (typeof raw !== "string") return null
  // DD/MM/YYYY or DD/MM/YYYY HH:mm
  const ddmmyyyy = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (ddmmyyyy) return new Date(+ddmmyyyy[3], +ddmmyyyy[2] - 1, +ddmmyyyy[1])
  // Date-only ISO (YYYY-MM-DD) as local midnight — new Date(raw) would parse it as
  // UTC and mismatch the local-midnight bounds coming from the calendar picker
  const isoDateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoDateOnly) return new Date(+isoDateOnly[1], +isoDateOnly[2] - 1, +isoDateOnly[3])
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
}

export const dateRangeFilterFn: FilterFn<unknown> = (
  row: Row<unknown>,
  columnId: string,
  filterValue: DateRangeFilter,
) => {
  const date = parseDateValue(row.getValue(columnId))
  if (!date) return true
  const { from, to } = filterValue
  if (from && date < from) return false
  if (to) {
    const endOfDay = new Date(to)
    endOfDay.setHours(23, 59, 59, 999)
    if (date > endOfDay) return false
  }
  return true
}

export const dateSingleFilterFn: FilterFn<unknown> = (
  row: Row<unknown>,
  columnId: string,
  filterValue: Date | undefined,
) => {
  if (!(filterValue instanceof Date)) return true
  const date = parseDateValue(row.getValue(columnId))
  if (!date) return true
  return (
    date.getFullYear() === filterValue.getFullYear() &&
    date.getMonth() === filterValue.getMonth() &&
    date.getDate() === filterValue.getDate()
  )
}

/** Checkbox filters infer `""` for null; normalize cell values so empty rows match. */
export const checkboxIncludesSomeFilterFn: FilterFn<unknown> = (
  row: Row<unknown>,
  columnId: string,
  filterValue: unknown,
) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true
  const raw = row.getValue(columnId)
  const val = raw == null ? "" : String(raw)
  return (filterValue as string[]).some((item) => item === val)
}

/** Checkbox filter when each row holds multiple values (e.g. string[]). */
export const checkboxArrayIncludesSomeFilterFn: FilterFn<unknown> = (
  row: Row<unknown>,
  columnId: string,
  filterValue: unknown,
) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) return true
  const raw = row.getValue(columnId)
  const cellValues = Array.isArray(raw)
    ? (raw as unknown[]).map((item) => String(item))
    : raw == null || raw === ""
      ? []
      : [String(raw)]
  return (filterValue as string[]).some((item) => cellValues.includes(item))
}

export function createMultiColumnTextFilterFn<TData>(extraColumnIds: string[]): FilterFn<TData> {
  const filterFn: FilterFn<TData> = (row: Row<TData>, columnId: string, filterValue: string) => {
    if (!filterValue) return true
    const needle = filterValue.toLowerCase()
    const data = row.original as Record<string, unknown>
    return [columnId, ...extraColumnIds].some((id) =>
      String(data[id] ?? "").toLowerCase().includes(needle)
    )
  }
  filterFn.autoRemove = (val) => !val
  return filterFn
}

const LINK_BASE_CLASSES = "text-xs font-medium text-emerald-700 hover:text-emerald-700 hover:underline"

const LINK_VARIANT_CLASSES: Record<ColumnLinkVariant, string> = {
  primary: "",
  default: "",
  mono: "font-mono",
  /** Ticker de ativo — mesma fonte de código do ISIN/CNPJ. */
  asset: "font-mono",
  muted: "",
}

function renderDefaultValue(value: unknown): ReactNode {
  return String(value ?? "")
}

function renderLinkedCell<TData>(
  col: ColumnMetadata<TData>,
  row: Row<TData>,
  value: unknown,
): ReactNode {
  const link = col.link
  if (!link) {
    if (col.formatter) return col.formatter(value)
    return renderDefaultValue(value)
  }

  const rowData = row.original
  const href = link.href(rowData)
  const label = link.label
    ? link.label(rowData)
    : col.formatter
      ? col.formatter(value)
      : renderDefaultValue(value)
  const subtitle = link.subtitle?.(rowData)
  const variant = link.variant ?? "primary"
  const className = cn(link.className, LINK_VARIANT_CLASSES[variant], LINK_BASE_CLASSES)
  const title = link.title?.(rowData)

  const primary = href ? (
    <Link
      href={href}
      className={className}
      title={title}
      onClick={(event) => link.onClick?.(rowData, event)}
    >
      {label}
    </Link>
  ) : (
    <span>{label}</span>
  )

  if (subtitle == null || subtitle === false) return primary

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      {primary}
      <div className={cn("text-xs text-muted-foreground", link.subtitleClassName)}>
        {subtitle}
      </div>
    </div>
  )
}

/**
 * The cell and the header of every metadata column are these two components;
 * the column's own renderer travels in `meta`. flexRender mounts a function
 * renderer as a component, so a renderer rebuilt with the metadata — an inline
 * `cell` in a useMemo with a volatile dependency, or the default renderer
 * below, a new closure on every build — was a new component TYPE, and React
 * unmounted and remounted every cell of the column (with any chart inside it).
 * With one stable type the cell re-renders in place and reads the newest
 * renderer from `meta`.
 *
 * The renderer is CALLED, not mounted, so it must not call a hook in its own
 * body — none of the ~800 `cell`/`header` renderers in the app did when this
 * landed (24/09/2026). A cell that needs a hook returns a component element.
 */
function MetadataCell<TData>(props: CellContext<TData, unknown>): ReactNode {
  return props.column.columnDef.meta?.renderCell?.(props) ?? null
}

function MetadataHeader<TData>(props: HeaderContext<TData, unknown>): ReactNode {
  return props.column.columnDef.meta?.renderHeader?.(props) ?? null
}

export function buildColumnsFromMetadata<TData>(
  metadata: readonly ColumnMetadata<TData>[],
): ColumnDef<TData>[] {
  return metadata.map((col) => {
    const colDef: ColumnDef<TData> = {
      id: col.columnId,
      accessorKey: col.columnId,
      enableSorting: col.sortable ?? false,
      ...(col.sortingFn ? { sortingFn: col.sortingFn } : {}),
      enableHiding: col.filterOnly ? false : (col.hideable ?? true),
      meta: {
        displayName: col.title,
        filterOnly: col.filterOnly,
        className: cn(
          col.aligned === "right" && "text-right",
          col.aligned === "center" && "text-center",
          col.aligned === "left" && "text-left",
          col.columnClassName,
        ),
        renderHeader: col.header
          ? col.header
          : ({ column }) => (
              <DataTableColumnHeader column={column} title={col.title} subtitle={col.subtitle} description={col.description} />
            ),
        renderCell: col.cell
          ? col.cell
          : ({ getValue, row }) => {
              const value = getValue()
              return renderLinkedCell(col, row, value)
            }},
      header: MetadataHeader,
      cell: MetadataCell}

    if (col.filters?.number) {
      colDef.filterFn = numberConditionFilterFn as FilterFn<TData>
    } else if (col.filters?.checkboxArray) {
      colDef.filterFn = checkboxArrayIncludesSomeFilterFn as FilterFn<TData>
    } else if (col.filters?.checkbox || col.filters?.checkboxSearch) {
      colDef.filterFn = checkboxIncludesSomeFilterFn as FilterFn<TData>
    } else if (col.filters?.percentage) {
      colDef.filterFn = percentageRangeFilterFn as FilterFn<TData>
    } else if (col.filters?.date) {
      colDef.filterFn = dateRangeFilterFn as FilterFn<TData>
    } else if (col.filters?.dateSingle) {
      colDef.filterFn = dateSingleFilterFn as FilterFn<TData>
    } else if (col.filters?.text && col.filters.textColumns?.length) {
      colDef.filterFn = createMultiColumnTextFilterFn<TData>(col.filters.textColumns)
    } else if (col.filters?.text) {
      colDef.filterFn = "includesString"
    }

    return colDef
  })
}
