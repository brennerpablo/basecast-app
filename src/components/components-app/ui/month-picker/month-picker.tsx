"use client"

import { format, setMonth, setYear } from "date-fns"
import { enUS, ptBR } from "date-fns/locale"
import {
  CalendarDays,
  ChevronLeftIcon,
  ChevronRightIcon
} from "lucide-react"
import * as React from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// --- i18n ---

type MonthPickerLanguage = "en" | "pt"

const localeMap = { en: enUS, pt: ptBR } as const

const translations = {
  en: { placeholder: "Pick month", year: "Year", month: "Month" },
  pt: { placeholder: "Selecione o mês", year: "Ano", month: "Mês" }} as const

// --- Types ---

type MonthPickerSize = "default" | "sm"

const sizeStyles = {
  default: { button: "h-9 px-3", icon: "h-9 w-9", width: "w-52" },
  sm: { button: "h-8 px-2.5 text-xs", icon: "h-8 w-8", width: "w-44" }} as const

interface MonthPickerProps {
  value?: { year: number; month: number }
  onChange?: (value: { year: number; month: number } | undefined) => void
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  language?: MonthPickerLanguage
  size?: MonthPickerSize
  shadow?: "none" | "xs" | "sm"
  minDate?: { year: number; month: number }
  maxDate?: { year: number; month: number }
  enableMonthNavigation?: boolean
  triggerClassName?: string
  wrapperClassName?: string
  className?: string
}

// --- Helpers ---

function getMonthNames(lang: MonthPickerLanguage): string[] {
  const locale = localeMap[lang]
  return Array.from({ length: 12 }, (_, i) => {
    const date = setMonth(new Date(2024, 0, 1), i)
    return format(date, "MMMM", { locale })
  })
}

function getDisplayLabel(
  value: { year: number; month: number } | undefined,
  lang: MonthPickerLanguage
): string | null {
  if (!value) return null
  const locale = localeMap[lang]
  const date = setYear(setMonth(new Date(2024, 0, 1), value.month), value.year)
  return format(date, "MMMM yyyy", { locale })
}

function clampYearMonth(
  ym: { year: number; month: number },
  min?: { year: number; month: number },
  max?: { year: number; month: number }
): { year: number; month: number } {
  let { year, month } = ym
  if (min && (year < min.year || (year === min.year && month < min.month))) {
    year = min.year
    month = min.month
  }
  if (max && (year > max.year || (year === max.year && month > max.month))) {
    year = max.year
    month = max.month
  }
  return { year, month }
}

// --- Component ---

function MonthPicker({
  value,
  onChange,
  placeholder,
  disabled = false,
  loading = false,
  language = "en",
  size = "default",
  shadow = "xs",
  minDate,
  maxDate,
  enableMonthNavigation = false,
  triggerClassName,
  wrapperClassName,
  className}: MonthPickerProps) {
  const isDisabled = disabled || loading
  const s = sizeStyles[size]
  const t = translations[language]
  const monthNames = getMonthNames(language)

  const [open, setOpen] = React.useState(false)

  const label = getDisplayLabel(value, language)

  const currentYear = new Date().getFullYear()
  const minYear = minDate?.year ?? currentYear - 100
  const maxYear = maxDate?.year ?? currentYear + 10
  const years = Array.from(
    { length: maxYear - minYear + 1 },
    (_, i) => minYear + i
  )

  function getAvailableMonths(year: number): number[] {
    let start = 0
    let end = 11
    if (minDate && year === minDate.year) start = minDate.month
    if (maxDate && year === maxDate.year) end = maxDate.month
    return Array.from({ length: end - start + 1 }, (_, i) => start + i)
  }

  function handleYearChange(newYear: number) {
    const month = value?.month ?? new Date().getMonth()
    const clamped = clampYearMonth({ year: newYear, month }, minDate, maxDate)
    onChange?.(clamped)
  }

  function handleMonthChange(newMonth: number) {
    const year = value?.year ?? currentYear
    onChange?.({ year, month: newMonth })
    setOpen(false)
  }

  function navigateMonth(offset: number) {
    const base = value ?? { year: currentYear, month: new Date().getMonth() }
    let newMonth = base.month + offset
    let newYear = base.year
    if (newMonth > 11) {
      newMonth = 0
      newYear++
    } else if (newMonth < 0) {
      newMonth = 11
      newYear--
    }
    const next = { year: newYear, month: newMonth }
    if (
      minDate &&
      (next.year < minDate.year ||
        (next.year === minDate.year && next.month < minDate.month))
    )
      return
    if (
      maxDate &&
      (next.year > maxDate.year ||
        (next.year === maxDate.year && next.month > maxDate.month))
    )
      return
    onChange?.(next)
  }

  const triggerButton = (
    <Button
      variant="outline"
      disabled={isDisabled}
      className={cn(
        s.button,
        "justify-start text-left font-normal rounded-md capitalize",
        enableMonthNavigation
          ? "flex-1 rounded-none border-x-0 shadow-none"
          : cn(
              s.width,
              shadow === "xs" && "shadow-xs",
              shadow === "sm" && "shadow-sm"
            ),
        triggerClassName
      )}
    >
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      {loading ? (
        <span className="h-4 w-24 animate-pulse rounded bg-muted" />
      ) : (
        <span className="capitalize">{label ?? placeholder ?? t.placeholder}</span>
      )}
    </Button>
  )

  const selectClass =
    "h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-xs outline-hidden focus:border-ring focus:ring-[3px] focus:ring-ring/50 capitalize"

  return (
    <div
      className={cn(
        "flex items-center",
        enableMonthNavigation
          ? cn(
              s.width,
              "rounded-md",
              shadow === "xs" && "shadow-xs",
              shadow === "sm" && "shadow-sm"
            )
          : "w-fit",
        wrapperClassName
      )}
    >
      {enableMonthNavigation && (
        <Button
          variant="outline"
          disabled={isDisabled}
          className={cn(s.icon, "rounded-r-none shadow-none p-0")}
          onClick={() => navigateMonth(-1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn("w-auto p-4", className)}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t.year}
              </label>
              <select
                value={value?.year ?? ""}
                onChange={(e) => handleYearChange(Number(e.target.value))}
                className={selectClass}
              >
                {!value && <option value="" disabled />}
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t.month}
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {getAvailableMonths(value?.year ?? currentYear).map((m) => (
                  <Button
                    key={m}
                    variant={value?.month === m ? "default" : "outline"}
                    size="sm"
                    className="capitalize text-xs h-8"
                    onClick={() => handleMonthChange(m)}
                  >
                    {monthNames[m].slice(0, 3)}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      {enableMonthNavigation && (
        <Button
          variant="outline"
          disabled={isDisabled}
          className={cn(s.icon, "rounded-l-none shadow-none p-0")}
          onClick={() => navigateMonth(1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      )}
    </div>
  )
}

export { MonthPicker }
export type { MonthPickerLanguage, MonthPickerProps }
