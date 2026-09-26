"use client"

import * as React from "react"

import { Checkbox } from "@/components/components-app/ui/checkbox"
import { DatePicker } from "@/components/components-app/ui/date-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/components-app/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import type { EditableColumnDef, EditableGridLanguage } from "./types"

type EditableCellProps<TData extends Record<string, unknown>> = {
  column: EditableColumnDef<TData>
  value: unknown
  row: TData
  isEditing: boolean
  draftValue: unknown
  error: string | null
  language: EditableGridLanguage
  compact: boolean
  onStartEdit: () => void
  onDraftChange: (v: unknown) => void
  onCommit: () => void
  onCancel: () => void
  onCheckboxToggle: (checked: boolean) => void
}

function EditableCellInner<TData extends Record<string, unknown>>({
  column,
  value,
  row,
  isEditing,
  draftValue,
  error,
  language,
  compact,
  onStartEdit,
  onDraftChange,
  onCommit,
  onCancel,
  onCheckboxToggle}: EditableCellProps<TData>) {
  const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      if (inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select()
      }
    }
  }, [isEditing])

  const alignment =
    column.aligned === "right"
      ? "text-right"
      : column.aligned === "center"
        ? "text-center"
        : "text-left"

  // Checkbox: always interactive (no edit mode toggle)
  if (column.type === "checkbox") {
    return (
      <div className={cn("flex items-center", alignment === "text-center" ? "justify-center" : alignment === "text-right" ? "justify-end" : "justify-start")}>
        <Checkbox
          checked={!!value}
          disabled={column.readonly}
          onCheckedChange={(checked) => onCheckboxToggle(checked === true)}
        />
      </div>
    )
  }

  // Readonly: always display mode
  if (column.readonly) {
    return (
      <div className={cn("truncate", alignment)}>
        {column.formatter ? column.formatter(value, row) : String(value ?? "")}
      </div>
    )
  }

  // Display mode
  if (!isEditing) {
    const displayContent = column.formatter
      ? column.formatter(value, row)
      : column.type === "select"
        ? column.options?.find((o) => o.value === String(value))?.label ??
          String(value ?? "")
        : column.type === "date"
          ? String(value ?? "")
          : String(value ?? "")

    const cellContent = (
      <div
        className={cn(
          "cursor-pointer truncate min-h-6",
          alignment,
          error && "ring-1 ring-destructive/50"
        )}
        onClick={onStartEdit}
      >
        {displayContent || (
          <span className="text-muted-foreground/50">
            {column.placeholder ?? "—"}
          </span>
        )}
      </div>
    )

    if (error) {
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>{cellContent}</TooltipTrigger>
            <TooltipContent
              side="bottom"
              className="bg-destructive text-destructive-foreground text-xs"
            >
              {error}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return cellContent
  }

  // Edit mode
  switch (column.type) {
    case "text":
    case "number":
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type={column.type === "number" ? "number" : "text"}
          value={draftValue as string | number ?? ""}
          placeholder={column.placeholder}
          className={cn(
            "w-full bg-transparent outline-none",
            compact ? "h-6 text-xs" : "h-7 text-sm",
            alignment
          )}
          onChange={(e) =>
            onDraftChange(
              column.type === "number"
                ? e.target.value === ""
                  ? ""
                  : Number(e.target.value)
                : e.target.value
            )
          }
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation()
              onCancel()
            }
          }}
        />
      )

    case "textarea":
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={(draftValue as string) ?? ""}
          placeholder={column.placeholder}
          className={cn(
            "w-full bg-transparent outline-none resize-none text-sm"
          )}
          rows={2}
          onChange={(e) => onDraftChange(e.target.value)}
          onBlur={onCommit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation()
              onCancel()
            }
          }}
        />
      )

    case "select":
      return (
        <div className="relative h-0 overflow-visible">
          <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0">
            <Select
              value={String(draftValue ?? "")}
              onValueChange={(val) => {
                onDraftChange(val)
                setTimeout(() => onCommit(), 0)
              }}
              open
              onOpenChange={(open) => {
                if (!open) onCommit()
              }}
            >
              <SelectTrigger
                size="sm"
                shadow="none"
                className="h-7 border-0 shadow-none text-xs opacity-0 pointer-events-none"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {column.options?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )

    case "date": {
      const dateDisplay = column.formatter
        ? column.formatter(draftValue, row)
        : String(draftValue ?? "")
      return (
        <>
          <div className={cn("truncate min-h-6", alignment)}>
            {dateDisplay || (
              <span className="text-muted-foreground/50">
                {column.placeholder ?? "—"}
              </span>
            )}
          </div>
          <DateCellEditor draftValue={draftValue} onDraftChange={onDraftChange} onCommit={onCommit} language={language} />
        </>
      )
    }

    default:
      return <span>{String(value ?? "")}</span>
  }
}

function DateCellEditor({
  draftValue,
  onDraftChange,
  onCommit,
  language}: {
  draftValue: unknown
  onDraftChange: (v: unknown) => void
  onCommit: () => void
  language: EditableGridLanguage
}) {
  const triggerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    // Auto-click the trigger to open the popover on mount
    const btn = triggerRef.current?.querySelector("button")
    if (btn) btn.click()
  }, [])

  return (
    <div ref={triggerRef} className="relative h-0 overflow-visible">
      <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0">
        <DatePicker
          mode="single"
          value={(draftValue as string | Date) ?? undefined}
          onChange={(date) => {
            onDraftChange(date)
            setTimeout(() => onCommit(), 0)
          }}
          language={language}
          size="sm"
          shadow="none"
          displayFormat="short"
          triggerClassName="h-7 border-0 shadow-none text-xs opacity-0"
        />
      </div>
    </div>
  )
}

export const EditableCell = React.memo(EditableCellInner) as typeof EditableCellInner
