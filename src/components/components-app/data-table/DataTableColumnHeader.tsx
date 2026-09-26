import { Column } from "@tanstack/react-table"
import {
  ChevronDown,
  ChevronUp,
  Info
} from "lucide-react"
import { Tooltip } from "radix-ui"
import React from "react"

import { cn } from "@/lib/utils"

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>
  title: string
  subtitle?: string
  description?: string
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  subtitle,
  description,
  className}: DataTableColumnHeaderProps<TData, TValue>) {
  const textBlock = (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] font-medium leading-none">{title}</span>
      {subtitle && (
        <span className="text-[11px] font-normal text-muted-foreground leading-none">
          {subtitle}
        </span>
      )}
    </div>
  )

  const infoIcon = description ? (
    <Info className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
  ) : null

  const canSort = column.getCanSort()

  const content = canSort ? (
    <div
      // Hooks for consumers that render this header a second time in a
      // non-interactive context — see DataTableStickyHeader's `sortable={false}`.
      data-sort-trigger=""
      onClick={column.getToggleSortingHandler()}
      className={cn(
        column.columnDef.enableSorting === true
          ? "-mx-2 inline-flex cursor-pointer select-none items-center gap-2 rounded-md px-2 py-1 hover:bg-muted"
          : "",
      )}
    >
      {textBlock}
      {infoIcon}
      <div className="-space-y-2" data-sort-indicator="">
        <ChevronUp
          className={cn(
            "size-3.5 text-foreground",
            column.getIsSorted() === "desc" ? "opacity-30" : "",
          )}
          aria-hidden="true"
        />
        <ChevronDown
          className={cn(
            "size-3.5 text-foreground",
            column.getIsSorted() === "asc" ? "opacity-30" : "",
          )}
          aria-hidden="true"
        />
      </div>
    </div>
  ) : (
    <div className={cn("flex items-center gap-1.5", className)}>
      {textBlock}
      {infoIcon}
    </div>
  )

  if (!description) return content

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>{content}</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            className="z-50 max-w-xs rounded-md bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
            sideOffset={6}
          >
            {description}
            <Tooltip.Arrow className="fill-popover" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
