"use client"

import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2
} from "lucide-react"
import { OverlayScrollbarsComponent } from "overlayscrollbars-react"
import * as React from "react"

import { Checkbox } from "@/components/components-app/ui/checkbox"
import { Button } from "@/components/ui/button"
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { EditableCell } from "./EditableCell"
import { getLocale } from "./i18n"
import type { ActiveCell, EditableGridProps } from "./types"
import { useGridNavigation } from "./useGridNavigation"
import { validateCell } from "./validation"

function resolveAccentColor(color?: string): string {
  if (!color) return ""
  if (color.startsWith("#") || color.startsWith("rgb") || color.startsWith("hsl")) {
    return color
  }
  return `var(--color-${color})`
}

// Sticky bg for header and frozen columns — matches DataTable's bg-muted/50
// Solid bg for sticky elements — visually matches DataTable's bg-muted/50 over background
const STICKY_BG = "bg-[oklch(0.985_0_0)] dark:bg-[oklch(0.205_0_0)]"
// Shadows for sticky elements when content scrolls beneath them
const SHADOW_BOTTOM = "eg-shadow-bottom"
const SHADOW_RIGHT = "eg-shadow-right"

function EditableGridInner<TData extends Record<string, unknown>>({
  columns,
  data,
  rowIdKey,
  onCellChange,
  onRowChange,
  onAddRow,
  onDeleteRows,
  onSelectionChange,
  enableAddRow = false,
  enableDeleteRow = false,
  enableRowSelection = false,
  language = "en",
  bordered = false,
  compact = false,
  accentColor,
  stickyHeader = true,
  alwaysShowScrollbars = false,
  stickyColumns = 0,
  className}: EditableGridProps<TData>) {
  const locale = getLocale(language)
  const accent = resolveAccentColor(accentColor)

  // --- Sticky column left offsets ---
  const stickyColOffsets = React.useMemo(() => {
    const offsets: number[] = []
    let left = enableRowSelection ? 40 : 0
    const visible = columns.filter((c) => c.type !== undefined)
    for (let i = 0; i < stickyColumns && i < visible.length; i++) {
      offsets.push(left)
      const w = visible[i].width
      left += typeof w === "number" ? w : w ? parseInt(w, 10) || 0 : 0
    }
    return offsets
  }, [columns, stickyColumns, enableRowSelection])

  // --- Total table width (for table-layout: fixed with sticky columns) ---
  const tableWidth = React.useMemo(() => {
    if (stickyColumns <= 0) return undefined
    const visible = columns.filter((c) => c.type !== undefined)
    let total = enableRowSelection ? 40 : 0
    for (const col of visible) {
      const w = col.width
      total += typeof w === "number" ? w : w ? parseInt(w, 10) || 0 : 120
    }
    if (enableDeleteRow) total += 40
    return total
  }, [columns, stickyColumns, enableRowSelection, enableDeleteRow])

  // --- Scroll state for sticky shadows ---
  const [scrolledLeft, setScrolledLeft] = React.useState(false)
  const [scrolledTop, setScrolledTop] = React.useState(false)

  const handleScroll = React.useCallback((...args: unknown[]) => {
    const event = args.length >= 2 ? (args[1] as Event) : (args[0] as React.UIEvent)
    const target = (event?.target ?? event?.currentTarget) as HTMLElement | null
    if (target) {
      setScrolledLeft(target.scrollLeft > 0)
      setScrolledTop(target.scrollTop > 0)
    }
  }, [])

  // --- Sorting ---
  const [sortColumn, setSortColumn] = React.useState<string | null>(null)
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">("asc")

  const toggleSort = React.useCallback((columnId: string) => {
    if (sortColumn === columnId) {
      if (sortDirection === "asc") {
        setSortDirection("desc")
      } else {
        setSortColumn(null)
        setSortDirection("asc")
      }
    } else {
      setSortColumn(columnId)
      setSortDirection("asc")
    }
  }, [sortColumn, sortDirection])

  const sortedData = React.useMemo(() => {
    if (!sortColumn) return data
    const col = columns.find((c) => c.columnId === sortColumn)
    if (!col) return data
    return [...data].sort((a, b) => {
      const aVal = a[sortColumn as keyof TData]
      const bVal = b[sortColumn as keyof TData]
      if (aVal == null && bVal == null) return 0
      if (aVal == null) return 1
      if (bVal == null) return -1
      let cmp = 0
      if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal
      } else if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        cmp = (aVal ? 1 : 0) - (bVal ? 1 : 0)
      } else {
        cmp = String(aVal).localeCompare(String(bVal))
      }
      return sortDirection === "asc" ? cmp : -cmp
    })
  }, [data, columns, sortColumn, sortDirection])

  // --- Active cell ---
  const [activeCell, setActiveCell] = React.useState<ActiveCell | null>(null)
  const [errors, setErrors] = React.useState<Map<string, string>>(new Map())
  const [selectedRows, setSelectedRows] = React.useState<Set<string | number>>(new Set())

  const rowIds = React.useMemo(
    () => sortedData.map((row) => row[rowIdKey] as string | number),
    [sortedData, rowIdKey]
  )

  // --- Commit / Cancel ---

  const activeCellRef = React.useRef(activeCell)
  // eslint-disable-next-line react-hooks/refs
  activeCellRef.current = activeCell

  const commitActiveCell = React.useCallback(() => {
    const cell = activeCellRef.current
    if (!cell) return
    const { rowId, columnId, draftValue, originalValue } = cell
    const col = columns.find((c) => c.columnId === columnId)
    const row = data.find((r) => r[rowIdKey] === rowId)
    if (!col || !row) {
      setActiveCell(null)
      return
    }

    const error = validateCell(draftValue, col.validation, row, locale)
    const key = `${rowId}:${columnId}`
    setErrors((prev) => {
      const next = new Map(prev)
      if (error) { next.set(key, error) } else { next.delete(key) }
      return next
    })

    if (draftValue !== originalValue) {
      onCellChange?.(rowId, columnId, draftValue)
      if (onRowChange) {
        onRowChange(rowId, { ...row, [columnId]: draftValue })
      }
    }

    setActiveCell(null)
  }, [columns, data, rowIdKey, locale, onCellChange, onRowChange])

  const cancelActiveCell = React.useCallback(() => {
    setActiveCell(null)
  }, [])

  const { gridRef, handleKeyDown } = useGridNavigation({
    columns, data, rowIdKey, activeCell, setActiveCell,
    onCommit: commitActiveCell,
    onCancel: cancelActiveCell})

  // --- Row selection helpers ---

  const allSelected = data.length > 0 && selectedRows.size === data.length
  const someSelected = selectedRows.size > 0 && selectedRows.size < data.length

  // Notify on the setter rather than in an effect: an effect would also fire
  // for the programmatic clear after a delete, telling the parent the user
  // deselected when in fact the rows are gone.
  const applySelection = React.useCallback(
    (next: Set<string | number>) => {
      setSelectedRows(next)
      onSelectionChange?.(Array.from(next))
    },
    [onSelectionChange]
  )

  const toggleSelectAll = React.useCallback(() => {
    applySelection(allSelected ? new Set() : new Set(rowIds))
  }, [allSelected, rowIds, applySelection])

  const toggleSelectRow = React.useCallback(
    (rowId: string | number) => {
      const next = new Set(selectedRows)
      if (next.has(rowId)) { next.delete(rowId) } else { next.add(rowId) }
      applySelection(next)
    },
    [selectedRows, applySelection]
  )

  const startEdit = React.useCallback(
    (rowId: string | number, columnId: string) => {
      if (activeCell) commitActiveCell()
      const row = data.find((r) => r[rowIdKey] === rowId)
      if (!row) return
      const value = row[columnId as keyof TData]
      setActiveCell({ rowId, columnId, draftValue: value, originalValue: value })
    },
    [activeCell, commitActiveCell, data, rowIdKey]
  )

  const handleCheckboxToggle = React.useCallback(
    (rowId: string | number, columnId: string, checked: boolean) => {
      const row = data.find((r) => r[rowIdKey] === rowId)
      if (!row) return
      onCellChange?.(rowId, columnId, checked)
      if (onRowChange) onRowChange(rowId, { ...row, [columnId]: checked })
    },
    [data, rowIdKey, onCellChange, onRowChange]
  )

  const handleDeleteSelected = React.useCallback(() => {
    if (selectedRows.size > 0 && onDeleteRows) {
      onDeleteRows(Array.from(selectedRows))
      applySelection(new Set())
    }
  }, [selectedRows, onDeleteRows, applySelection])

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => c.type !== undefined),
    [columns]
  )

  // --- Padding classes matching DataTable ---
  const cellPy = compact ? "py-0.5" : "py-2"
  const headerTextSize = compact ? "text-xs" : "text-sm sm:text-xs"

  // --- Table content ---

  const checkboxSticky = stickyColumns > 0 && enableRowSelection

  const tableContent = (
    <table
      className={cn("caption-bottom text-sm w-full", stickyColumns > 0 && "table-fixed")}
      // Com colunas fixas a largura declarada é um MÍNIMO, não a largura final:
      // fixá-la em px deixava a grade encolhida quando o container é mais largo.
      // Abaixo desse mínimo o scroll horizontal volta e os offsets sticky valem.
      style={tableWidth ? { minWidth: `${tableWidth}px` } : undefined}
    >
      <TableHeader>
        {/* Header row — matches DataTable: bg-muted/50, border-b (bordered) or border-y (non-bordered) */}
        <TableRow
          className={cn(
            "hover:bg-transparent bg-muted/50",
            bordered ? "border-b" : "border-y"
          )}
        >
          {enableRowSelection && (
            <TableHead
              className={cn(
                "w-10",
                cellPy,
                stickyHeader && cn("sticky top-0 z-10", STICKY_BG),
                stickyHeader && scrolledTop && SHADOW_BOTTOM,
                checkboxSticky && "sticky left-0 z-20",
              )}
            >
              <Checkbox
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={toggleSelectAll}
                accentColor={accentColor}
              />
            </TableHead>
          )}
          {visibleColumns.map((col, colIdx) => {
            const isSticky = colIdx < stickyColumns
            const isBothSticky = isSticky && stickyHeader
            // Header cells only get bottom shadow; column shadow is handled by body cells
            const headerShadow = stickyHeader && scrolledTop ? SHADOW_BOTTOM : ""
            return (
              <TableHead
                key={col.columnId}
                className={cn(
                  headerTextSize,
                  cellPy,
                  col.aligned === "right" && "text-right",
                  col.aligned === "center" && "text-center",
                  stickyHeader && cn("sticky top-0", STICKY_BG),
                  isSticky && cn("sticky", STICKY_BG),
                  headerShadow,
                  isBothSticky ? "z-20" : (stickyHeader || isSticky) ? "z-10" : ""
                )}
                style={{
                  ...(col.width ? { width: typeof col.width === "number" ? `${col.width}px` : col.width } : {}),
                  ...(isSticky && col.width ? { minWidth: typeof col.width === "number" ? `${col.width}px` : col.width } : {}),
                  ...(isSticky ? { left: `${stickyColOffsets[colIdx]}px` } : {})}}
              >
                {col.sortable ? (
                  <button
                    type="button"
                    className="-mx-2 inline-flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1 group-hover:bg-muted"
                    onClick={() => toggleSort(col.columnId)}
                  >
                    <span className="text-[13px] font-medium leading-none">{col.title}</span>
                    <div className="flex flex-col -gap-y-2">
                      <ChevronUp
                        className={cn(
                          "size-3.5 text-foreground",
                          sortColumn === col.columnId && sortDirection === "desc" ? "opacity-30" : "",
                          sortColumn !== col.columnId && "opacity-30"
                        )}
                        aria-hidden="true"
                      />
                      <ChevronDown
                        className={cn(
                          "size-3.5 text-foreground",
                          sortColumn === col.columnId && sortDirection === "asc" ? "opacity-30" : "",
                          sortColumn !== col.columnId && "opacity-30"
                        )}
                        aria-hidden="true"
                      />
                    </div>
                  </button>
                ) : (
                  <span className="text-[13px] font-medium leading-none">{col.title}</span>
                )}
              </TableHead>
            )
          })}
          {enableDeleteRow && (
            <TableHead
              className={cn(
                "w-10",
                cellPy,
                stickyHeader && cn("sticky top-0 z-10", STICKY_BG),
                stickyHeader && scrolledTop && SHADOW_BOTTOM
              )}
            />
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedData.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={
                visibleColumns.length +
                (enableRowSelection ? 1 : 0) +
                (enableDeleteRow ? 1 : 0)
              }
              className="h-24 text-center text-muted-foreground"
            >
              {locale.noData}
            </TableCell>
          </TableRow>
        ) : (
          sortedData.map((row) => {
            const rowId = row[rowIdKey] as string | number
            const isSelected = selectedRows.has(rowId)
            return (
              <TableRow
                key={rowId}
                className={cn(
                  "group",
                  isSelected && "bg-muted/70"
                )}
              >
                {enableRowSelection && (
                  <TableCell
                    className={cn(
                      "w-10",
                      cellPy,
                      "text-muted-foreground",
                      checkboxSticky
                        ? cn("sticky left-0 z-5", STICKY_BG, "group-hover:bg-muted")
                        : "bg-background group-group-hover:bg-muted/30",
                      isSelected && "bg-muted/70",
                      checkboxSticky && scrolledLeft && SHADOW_RIGHT
                    )}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelectRow(rowId)}
                      accentColor={accentColor}
                    />
                  </TableCell>
                )}
                {visibleColumns.map((col, colIdx) => {
                  const cellValue = row[col.columnId as keyof TData]
                  const isEditing =
                    activeCell?.rowId === rowId &&
                    activeCell?.columnId === col.columnId
                  const errorKey = `${rowId}:${col.columnId}`
                  const cellError = errors.get(errorKey) ?? null
                  const isSticky = colIdx < stickyColumns

                  return (
                    <TableCell
                      key={col.columnId}
                      className={cn(
                        cellPy,
                        "text-muted-foreground",
                        isSticky
                          ? cn("sticky z-5", STICKY_BG, "group-hover:bg-muted")
                          : "bg-background group-group-hover:bg-muted/30",
                        isSelected && "bg-muted/70",
                        isSticky && scrolledLeft && SHADOW_RIGHT,
                        bordered && "first:pl-4 last:pr-4",
                        !isEditing && "hover:bg-[oklch(0.985_0_0)] dark:hover:bg-[oklch(0.205_0_0)]",
                        isEditing && "outline-2 outline-primary -outline-offset-1 z-10 bg-background"
                      )}
                      style={{
                        ...(col.width ? { width: typeof col.width === "number" ? `${col.width}px` : col.width } : {}),
                        ...(isSticky && col.width ? { minWidth: typeof col.width === "number" ? `${col.width}px` : col.width } : {}),
                        ...(isSticky ? { left: `${stickyColOffsets[colIdx]}px` } : {})}}
                    >
                      <EditableCell
                        column={col}
                        value={cellValue}
                        row={row}
                        isEditing={isEditing}
                        draftValue={isEditing ? activeCell.draftValue : cellValue}
                        error={cellError}
                        language={language}
                        compact={compact}
                        onStartEdit={() => startEdit(rowId, col.columnId)}
                        onDraftChange={(v) =>
                          setActiveCell((prev) =>
                            prev ? { ...prev, draftValue: v } : prev
                          )
                        }
                        onCommit={commitActiveCell}
                        onCancel={cancelActiveCell}
                        onCheckboxToggle={(checked) =>
                          handleCheckboxToggle(rowId, col.columnId, checked)
                        }
                      />
                    </TableCell>
                  )
                })}
                {enableDeleteRow && (
                  <TableCell
                    className={cn(
                      "w-10",
                      cellPy,
                      "text-muted-foreground bg-background group-group-hover:bg-muted/30",
                      isSelected && "bg-muted/70"
                    )}
                  >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => onDeleteRows?.([rowId])}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            )
          })
        )}
      </TableBody>
    </table>
  )

  return (
    <div
      ref={gridRef}
      className={cn(
        "relative flex flex-col h-full max-size-full",
        bordered && "rounded-md overflow-hidden border border-border",
        className
      )}
      style={accent ? ({ "--eg-accent": accent } as React.CSSProperties) : undefined}
      onKeyDown={handleKeyDown}
      role="grid"
    >
      {/* Bulk action bar */}
      {enableRowSelection && selectedRows.size > 0 && (
        <div className="flex-none flex items-center gap-2 px-2 py-1.5 bg-muted/50 border-b text-sm">
          <span className="text-muted-foreground">
            {selectedRows.size} {locale.selected}
          </span>
          {enableDeleteRow && onDeleteRows && (
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive hover:text-destructive"
              onClick={handleDeleteSelected}
            >
              <Trash2 className="size-3.5 mr-1" />
              {locale.deleteSelected}
            </Button>
          )}
        </div>
      )}

      {/* Scrollable table area */}
      {alwaysShowScrollbars ? (
        <OverlayScrollbarsComponent
          defer
          element="div"
          className="flex-1 min-h-0"
          style={{ maxHeight: "100%", maxWidth: "100%" }}
          options={{
            scrollbars: { autoHide: "never" },
            overflow: { x: "scroll", y: "scroll" }}}
          events={{ scroll: handleScroll }}
        >
          {tableContent}
        </OverlayScrollbarsComponent>
      ) : (
        <div className="grid-scrollbar flex-1 min-h-0 overflow-auto" onScroll={handleScroll}>
          {tableContent}
        </div>
      )}

      {/* Add row button */}
      {enableAddRow && onAddRow && (
        <div className="flex-none border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground gap-1"
            onClick={onAddRow}
          >
            <Plus className="size-3.5" />
            {locale.addRow}
          </Button>
        </div>
      )}
    </div>
  )
}

export const EditableGrid = React.memo(EditableGridInner) as typeof EditableGridInner
