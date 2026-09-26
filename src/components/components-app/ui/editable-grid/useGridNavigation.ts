import * as React from "react"

import type { ActiveCell, EditableColumnDef } from "./types"

type UseGridNavigationOptions<TData extends Record<string, unknown>> = {
  columns: EditableColumnDef<TData>[]
  data: TData[]
  rowIdKey: keyof TData & string
  activeCell: ActiveCell | null
  setActiveCell: React.Dispatch<React.SetStateAction<ActiveCell | null>>
  onCommit: () => void
  onCancel: () => void
}

function getEditableColumnIds<TData extends Record<string, unknown>>(
  columns: EditableColumnDef<TData>[]
): string[] {
  return columns
    .flatMap((c) => !c.readonly && c.type !== "checkbox" ? [c.columnId] : [])
}

export function useGridNavigation<TData extends Record<string, unknown>>({
  columns,
  data,
  rowIdKey,
  activeCell,
  setActiveCell,
  onCommit,
  onCancel,
}: UseGridNavigationOptions<TData>) {
  const gridRef = React.useRef<HTMLDivElement>(null)

  const editableColIds = React.useMemo(
    () => getEditableColumnIds(columns),
    [columns]
  )

  const rowIds = React.useMemo(
    () => data.map((row) => row[rowIdKey] as string | number),
    [data, rowIdKey]
  )

  const navigateTo = React.useCallback(
    (rowId: string | number, columnId: string) => {
      const row = data.find((r) => r[rowIdKey] === rowId)
      if (!row) return
      setActiveCell({
        rowId,
        columnId,
        draftValue: row[columnId as keyof TData],
        originalValue: row[columnId as keyof TData],
      })
    },
    [data, rowIdKey, setActiveCell]
  )

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!activeCell) return
      const { rowId, columnId } = activeCell
      const colIdx = editableColIds.indexOf(columnId)
      const rowIdx = rowIds.indexOf(rowId)

      if (colIdx === -1 || rowIdx === -1) return

      switch (e.key) {
        case "Tab": {
          e.preventDefault()
          onCommit()
          if (e.shiftKey) {
            // Move to previous editable cell
            if (colIdx > 0) {
              navigateTo(rowId, editableColIds[colIdx - 1])
            } else if (rowIdx > 0) {
              navigateTo(
                rowIds[rowIdx - 1],
                editableColIds[editableColIds.length - 1]
              )
            }
          } else {
            // Move to next editable cell
            if (colIdx < editableColIds.length - 1) {
              navigateTo(rowId, editableColIds[colIdx + 1])
            } else if (rowIdx < rowIds.length - 1) {
              navigateTo(rowIds[rowIdx + 1], editableColIds[0])
            }
          }
          break
        }

        case "Enter": {
          e.preventDefault()
          onCommit()
          // Move down to same column, next row
          if (rowIdx < rowIds.length - 1) {
            navigateTo(rowIds[rowIdx + 1], columnId)
          }
          break
        }

        case "Escape": {
          e.preventDefault()
          onCancel()
          break
        }
      }
    },
    [activeCell, editableColIds, rowIds, onCommit, onCancel, navigateTo]
  )

  return { gridRef, handleKeyDown }
}
