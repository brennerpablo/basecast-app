"use client"

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable} from "@tanstack/react-table"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { useDataTableLocale } from "./DataTableLocaleContext"

type DataTableNestedSubTableProps<TData> = {
  data: TData[]
  columns: ColumnDef<TData>[]
  getRowId?: (row: TData) => string
  bordered?: boolean
  compact?: boolean
  isGhost?: boolean
}

export function DataTableNestedSubTable<TData>({
  data,
  columns,
  getRowId,
  bordered = true,
  compact = false,
  isGhost = false}: DataTableNestedSubTableProps<TData>) {
  const locale = useDataTableLocale()
  const table = useReactTable({
    data,
    columns,
    getRowId: getRowId ? (row, i) => String(getRowId(row as TData) ?? i) : undefined,
    getCoreRowModel: getCoreRowModel()})

  return (
    <div className={cn("rounded-md border bg-background", !bordered && "border-0")}>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              key={headerGroup.id}
              className={cn(
                "border-border",
                !isGhost && "bg-muted/50 hover:bg-muted/50",
                !isGhost && "border-y",
              )}
            >
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={cn(
                    compact ? "whitespace-nowrap py-0.5 text-xs" : "whitespace-nowrap py-2 text-xs",
                    header.column.columnDef.meta?.className,
                  )}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(isGhost && "border-0! hover:bg-transparent")}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={cn(
                      compact ? "py-0.5 text-xs text-muted-foreground" : "py-2 text-sm text-muted-foreground",
                      cell.column.columnDef.meta?.className,
                    )}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={Math.max(1, columns.length)}
                className="h-12 text-center text-sm text-muted-foreground"
              >
                {locale.noResults}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
