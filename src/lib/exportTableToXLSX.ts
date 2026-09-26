import { Table } from "@tanstack/react-table"

export async function exportTableToXLSX<TData>(
  table: Table<TData>,
  filename: string = "export",
): Promise<void> {
  const XLSX = await import("xlsx")

  const exportableColumns = table
    .getAllLeafColumns()
    .filter((col) => col.getIsVisible() && col.accessorFn !== undefined)

  const headers = exportableColumns.map(
    (col) => col.columnDef.meta?.displayName ?? col.id,
  )

  const dataRows = table.getFilteredRowModel().rows.map((row) =>
    exportableColumns.map((col) => row.getValue(col.id)),
  )

  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1")
  XLSX.writeFile(
    wb,
    `${filename}-${new Date().toISOString().split("T")[0]}.xlsx`,
  )
}
