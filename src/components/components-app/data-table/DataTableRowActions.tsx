"use client"

import { Row } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "@/components/ui/dropdown-menu"

import { useDataTableLocale } from "./DataTableLocaleContext"

interface DataTableRowActionsProps<TData> {
  row: Row<TData>
  onAdd?: (row: TData) => void
  onEdit?: (row: TData) => void
  onDelete?: (row: TData) => void
}

export function DataTableRowActions<TData>({
  row,
  onAdd,
  onEdit,
  onDelete}: DataTableRowActionsProps<TData>) {
  const locale = useDataTableLocale()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="group aspect-square p-1.5 border border-transparent hover:border-border data-[state=open]:border-border data-[state=open]:bg-muted"
        >
          <MoreHorizontal
            className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground group-data-[state=open]:text-foreground"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {onAdd && (
          <DropdownMenuItem onClick={() => onAdd(row.original)}>
            {locale.add}
          </DropdownMenuItem>
        )}
        {onEdit && (
          <DropdownMenuItem onClick={() => onEdit(row.original)}>
            {locale.edit}
          </DropdownMenuItem>
        )}
        {onDelete && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => onDelete(row.original)}
          >
            {locale.delete}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
