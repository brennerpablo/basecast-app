"use client"

import {
  addDays,
  endOfDay,
  isSameDay,
  isWeekend,
  parse,
  parseISO,
  startOfDay} from "date-fns"
import { format } from "date-fns"
import { enUS, ptBR } from "date-fns/locale"
import {
  CalendarDays,
  ChevronLeftIcon,
  ChevronRightIcon
} from "lucide-react"
import * as React from "react"
import type { DateRange, DayButton, Matcher } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar, CalendarDayButton } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

// --- i18n ---

type DatePickerLanguage = "en" | "pt"

const localeMap = { en: enUS, pt: ptBR } as const

const translations = {
  en: {
    placeholder: "Pick",
    placeholderRange: "Pick",
    placeholderDateTime: "Pick",
    hours: "Hours",
    minutes: "Minutes",
    clear: "Clear",
    legendCnab: "Filing",
    legendViolation: "Violation",
  },
  pt: {
    placeholder: "Selecione",
    placeholderRange: "Selecione",
    placeholderDateTime: "Selecione",
    hours: "Horas",
    minutes: "Minutos",
    clear: "Limpar",
    legendCnab: "Remessa",
    legendViolation: "Violação",
  }} as const

// --- Default format strings ---

type DatePickerDisplayFormat = "long" | "short"

const formatsByDisplay = {
  long: { single: "PPP", range: "PPP", datetime: "PPP HH:mm" },
  short: { single: "dd/MM/yyyy", range: "dd/MM/yyyy", datetime: "dd/MM/yyyy HH:mm" }} as const

// --- Types ---

type DatePickerSize = "default" | "sm"

/** Marcadores visuais no calendário (dias permanecem clicáveis). */
type DatePickerMarkerKind = "cnab" | "violation"

type DatePickerMarkedDate = {
  /** `yyyy-MM-dd` */
  date: string
  kinds: DatePickerMarkerKind[]
}

const sizeStyles = {
  default: { button: "h-9 px-3", icon: "h-9 w-9", width: "w-70" },
  sm: { button: "h-8 px-2.5 text-xs", icon: "h-8 w-8", width: "w-60" }} as const

interface DatePickerBaseProps {
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  disableWeekends?: boolean
  disabledDates?: string[]
  /**
   * Datas em `yyyy-MM-dd` (ou ISO parseável) com marcadores no calendário.
   * Não desabilita dias — só indica presença de dado.
   */
  markedDates?: DatePickerMarkedDate[]
  /** Legenda abaixo do calendário quando há `markedDates`. Default: true. */
  showMarkedDatesLegend?: boolean
  /** Sobrescreve os rótulos da legenda (ex.: Retorno usa "Baixa" no lugar de "Remessa"). */
  legendLabels?: Partial<{ cnab: string; violation: string }>
  enableYearMonthSelect?: boolean
  language?: DatePickerLanguage
  displayFormat?: DatePickerDisplayFormat
  format?: string
  /** When set, `value` accepts a formatted string and `onChange` emits a formatted string (e.g. "yyyyMMdd", "yyyy-MM-dd"). */
  valueFormat?: string
  size?: DatePickerSize
  shadow?: "none" | "xs" | "sm"
  minDate?: Date
  maxDate?: Date
  triggerClassName?: string
  wrapperClassName?: string
  className?: string
}

interface DatePickerSingleProps extends DatePickerBaseProps {
  mode?: "single"
  value?: Date | string
  onChange?: (date: Date | string | undefined) => void
  enableDayNavigation?: boolean
}

interface DatePickerRangeProps extends DatePickerBaseProps {
  mode: "range"
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
}

interface DatePickerDateTimeProps extends DatePickerBaseProps {
  mode: "datetime"
  value?: Date | string
  onChange?: (date: Date | string | undefined) => void
}

type DatePickerProps =
  | DatePickerSingleProps
  | DatePickerRangeProps
  | DatePickerDateTimeProps

// --- Trigger label ---

function getDisplayLabel(
  props: DatePickerProps,
  lang: DatePickerLanguage
): string | null {
  const locale = localeMap[lang]
  const mode = props.mode ?? "single"
  const display = props.displayFormat ?? "long"
  const defaults = formatsByDisplay[display]
  const vf = props.valueFormat

  if (mode === "range") {
    const rangeProps = props as DatePickerRangeProps
    if (!rangeProps.value?.from) return null
    const fmt = rangeProps.format ?? defaults.range
    const fromStr = format(rangeProps.value.from, fmt, { locale })
    const toStr = rangeProps.value.to
      ? format(rangeProps.value.to, fmt, { locale })
      : "..."
    return `${fromStr} – ${toStr}`
  }

  const dateProps = props as DatePickerSingleProps | DatePickerDateTimeProps
  if (!dateProps.value) return null
  const date = parseValueToDate(dateProps.value, vf)
  if (!date) return null
  const fmt = dateProps.format ?? defaults[mode as "single" | "datetime"]
  return format(date, fmt, { locale })
}

function getPlaceholder(
  props: DatePickerProps,
  lang: DatePickerLanguage
): string {
  if (props.placeholder) return props.placeholder
  const t = translations[lang]
  const mode = props.mode ?? "single"
  if (mode === "range") return t.placeholderRange
  if (mode === "datetime") return t.placeholderDateTime
  return t.placeholder
}

// --- Component ---

// --- Value format helpers ---

function parseValueToDate(value: Date | string | undefined, valueFormat?: string): Date | undefined {
  if (!value) return undefined
  if (value instanceof Date) return value
  if (valueFormat) return parse(value, valueFormat, new Date())
  // Fallback: try ISO parse
  const [year, month, day] = value.split("-").map(Number)
  if (year && month && day) return new Date(year, month - 1, day)
  return undefined
}

function formatDateToValue(date: Date | undefined, valueFormat?: string): Date | string | undefined {
  if (!date) return undefined
  if (valueFormat) return format(date, valueFormat)
  return date
}

function pickerStringToLocalDate(value: string): Date | undefined {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

function buildMarkedModifiers(markedDates: DatePickerMarkedDate[] | undefined) {
  const cnab: Date[] = []
  const violation: Date[] = []
  if (!markedDates?.length) {
    return { cnab, violation, hasAny: false }
  }
  for (const entry of markedDates) {
    const date = pickerStringToLocalDate(entry.date)
    if (!date) continue
    if (entry.kinds.includes("cnab")) cnab.push(date)
    if (entry.kinds.includes("violation")) violation.push(date)
  }
  return { cnab, violation, hasAny: cnab.length > 0 || violation.length > 0 }
}

function MarkedCalendarDayButton({
  className,
  day,
  modifiers,
  children,
  ...props
}: React.ComponentProps<typeof DayButton>) {
  const showCnab = Boolean(modifiers.cnab)
  const showViolation = Boolean(modifiers.violation)

  return (
    <CalendarDayButton
      className={cn("relative pb-1.5", className)}
      day={day}
      modifiers={modifiers}
      {...props}
    >
      {children}
      {showCnab || showViolation ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0.5 flex items-center justify-center gap-0.5"
        >
          {showCnab ? <span className="size-1 rounded-full bg-emerald-500" /> : null}
          {showViolation ? <span className="size-1 rounded-full bg-orange-500" /> : null}
        </span>
      ) : null}
    </CalendarDayButton>
  )
}

function DatePicker(props: DatePickerProps) {
  const {
    disabled = false,
    loading = false,
    disableWeekends = false,
    disabledDates,
    markedDates,
    showMarkedDatesLegend = true,
    legendLabels,
    enableYearMonthSelect = false,
    language = "en",
    valueFormat,
    size = "default",
    shadow = "xs",
    minDate,
    maxDate,
    triggerClassName,
    wrapperClassName,
    className} = props

  const isDisabled = disabled || loading

  const s = sizeStyles[size]

  const mode = props.mode ?? "single"
  const enableDayNavigation =
    mode === "single" &&
    (props as DatePickerSingleProps).enableDayNavigation === true
  const [open, setOpen] = React.useState(false)

  const locale = localeMap[language]
  const label = getDisplayLabel(props, language)
  const placeholder = getPlaceholder(props, language)
  const t = translations[language]

  const markedModifiers = React.useMemo(
    () => buildMarkedModifiers(markedDates),
    [markedDates],
  )

  function isDateDisabled(date: Date): boolean {
    if (disableWeekends && isWeekend(date)) return true
    if (disabledDates?.some((d) => isSameDay(parseISO(d), date))) return true
    return false
  }

  function navigateDay(offset: number) {
    const p = props as DatePickerSingleProps
    const base = parseValueToDate(p.value, valueFormat) ?? new Date()
    const direction = offset > 0 ? 1 : -1
    let next = addDays(base, direction)
    // Skip disabled dates (cap at 365 to avoid infinite loops)
    let safety = 0
    while (isDateDisabled(next) && safety < 365) {
      next = addDays(next, direction)
      safety++
    }
    if (minDate && next < minDate) return
    if (maxDate && next > maxDate) return
    p.onChange?.(formatDateToValue(next, valueFormat))
  }

  // --- Calendar handlers per mode ---

  function handleSingleSelect(date: Date | undefined) {
    const p = props as DatePickerSingleProps
    p.onChange?.(formatDateToValue(date, valueFormat))
    if (date) setOpen(false)
  }

  function handleRangeSelect(range: DateRange | undefined) {
    const p = props as DatePickerRangeProps
    p.onChange?.(range)
    if (
      range?.from &&
      range?.to &&
      range.from.getTime() !== range.to.getTime()
    ) {
      setOpen(false)
    }
  }

  function handleDateTimeSelect(date: Date | undefined) {
    const p = props as DatePickerDateTimeProps
    if (!date) {
      p.onChange?.(undefined)
      return
    }
    // Preserve existing time when selecting a new date
    const existing = parseValueToDate(p.value, valueFormat)
    if (existing) {
      date.setHours(existing.getHours())
      date.setMinutes(existing.getMinutes())
    }
    p.onChange?.(formatDateToValue(date, valueFormat))
  }

  function handleTimeChange(hours: number, minutes: number) {
    const p = props as DatePickerDateTimeProps
    const current = parseValueToDate(p.value, valueFormat)
    if (!current) return
    const updated = new Date(current)
    updated.setHours(hours)
    updated.setMinutes(minutes)
    p.onChange?.(formatDateToValue(updated, valueFormat))
  }

  // --- Calendar props per mode ---

  // `minDate`/`maxDate` also have to be disabled matchers, not just the
  // `startMonth`/`endMonth` bounds below. Those bounds only limit which months
  // you can navigate to — every day inside the boundary month stays clickable,
  // so a `maxDate` mid-month silently allowed picking the rest of it. The day
  // arrows already refused to cross the bounds, which made the calendar and the
  // arrows disagree.
  //
  // Compared at day boundaries, not at the raw instant: a bound built from a
  // fixed timezone (`2026-08-06` anchored to São Paulo) lands mid-day for a
  // viewer further west, and `after: <that instant>` would disable the bound's
  // own day.
  const disabledMatchers: Matcher[] = [
    ...(disableWeekends ? [{ dayOfWeek: [0, 6] }] : []),
    ...(minDate ? [{ before: startOfDay(minDate) }] : []),
    ...(maxDate ? [{ after: endOfDay(maxDate) }] : []),
    ...(disabledDates?.map((d) => parseISO(d)) ?? []),
  ]

  const calendarSharedProps = {
    locale: locale as any,
    ...(enableYearMonthSelect
      ? {
          captionLayout: "dropdown" as const,
          startMonth: minDate ?? new Date(new Date().getFullYear() - 100, 0),
          endMonth: maxDate ?? new Date(new Date().getFullYear() + 10, 11)}
      : {}),
    ...(minDate ? { fromDate: minDate } : {}),
    ...(maxDate ? { toDate: maxDate } : {}),
    ...(disabledMatchers.length > 0 ? { disabled: disabledMatchers } : {}),
    ...(markedModifiers.hasAny
      ? {
          modifiers: {
            cnab: markedModifiers.cnab,
            violation: markedModifiers.violation,
          },
          components: {
            DayButton: MarkedCalendarDayButton,
          },
        }
      : {}),
  }

  const markerLegend =
    showMarkedDatesLegend && markedModifiers.hasAny ? (
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        {markedModifiers.cnab.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {legendLabels?.cnab ?? t.legendCnab}
          </span>
        ) : null}
        {markedModifiers.violation.length > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-orange-500" />
            {legendLabels?.violation ?? t.legendViolation}
          </span>
        ) : null}
      </div>
    ) : null

  const triggerButton = (
    <Button
      variant="outline"
      disabled={isDisabled}
      className={cn(
        s.button,
        "justify-start text-left font-normal rounded-md",
        enableDayNavigation ? "flex-1 rounded-none border-x-0 shadow-none" : cn(s.width, shadow === "xs" && "shadow-xs", shadow === "sm" && "shadow-sm"),
        triggerClassName
      )}
    >
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
      {loading ? (
        <span className="h-4 w-24 animate-pulse rounded bg-muted" />
      ) : (label ?? placeholder)}
    </Button>
  )

  return (
    <div className={cn("flex items-center", enableDayNavigation ? cn(s.width, "rounded-md", shadow === "xs" && "shadow-xs", shadow === "sm" && "shadow-sm") : "w-fit", wrapperClassName)}>
      {enableDayNavigation && (
        <Button
          variant="outline"
          disabled={isDisabled}
          className={cn(s.icon, "rounded-r-none shadow-none p-0")}
          onClick={() => navigateDay(-1)}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {triggerButton}
        </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-auto p-0", className)}
      >
        {mode === "single" && (
          <Calendar
            mode="single"
            required={false}
            selected={parseValueToDate((props as DatePickerSingleProps).value, valueFormat)}
            onSelect={handleSingleSelect}
            {...calendarSharedProps}
          />
        )}

        {mode === "range" && (
          <>
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={(props as DatePickerRangeProps).value}
              onSelect={handleRangeSelect}
              {...calendarSharedProps}
            />
            {(props as DatePickerRangeProps).value?.from && (
              <div className="flex justify-end border-t border-border px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    ;(props as DatePickerRangeProps).onChange?.(undefined)
                  }}
                >
                  {t.clear}
                </Button>
              </div>
            )}
          </>
        )}

        {mode === "datetime" && (
          <>
            <Calendar
              mode="single"
              selected={parseValueToDate((props as DatePickerDateTimeProps).value, valueFormat)}
              onSelect={handleDateTimeSelect}
              {...calendarSharedProps}
            />
            <div className="border-t border-border p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t.hours}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={23}
                    value={
                      (props as DatePickerDateTimeProps).value
                        ? String(
                            parseValueToDate((props as DatePickerDateTimeProps).value, valueFormat)!.getHours()
                          ).padStart(2, "0")
                        : "00"
                    }
                    onChange={(e) => {
                      const h = Math.min(23, Math.max(0, Number(e.target.value)))
                      const m =
                        parseValueToDate((props as DatePickerDateTimeProps).value, valueFormat)?.getMinutes() ??
                        0
                      handleTimeChange(h, m)
                    }}
                    className="h-9 w-16 rounded-md border border-input bg-transparent px-2 text-center text-sm shadow-xs outline-hidden focus:border-ring focus:ring-[3px] focus:ring-ring/50"
                  />
                </div>
                <span className="mt-5 text-sm font-medium text-muted-foreground">
                  :
                </span>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t.minutes}
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={
                      (props as DatePickerDateTimeProps).value
                        ? String(
                            parseValueToDate((props as DatePickerDateTimeProps).value, valueFormat)!.getMinutes()
                          ).padStart(2, "0")
                        : "00"
                    }
                    onChange={(e) => {
                      const m = Math.min(59, Math.max(0, Number(e.target.value)))
                      const h =
                        parseValueToDate((props as DatePickerDateTimeProps).value, valueFormat)?.getHours() ?? 0
                      handleTimeChange(h, m)
                    }}
                    className="h-9 w-16 rounded-md border border-input bg-transparent px-2 text-center text-sm shadow-xs outline-hidden focus:border-ring focus:ring-[3px] focus:ring-ring/50"
                  />
                </div>
              </div>
            </div>
          </>
        )}
        {markerLegend}
      </PopoverContent>
    </Popover>
      {enableDayNavigation && (
        <Button
          variant="outline"
          disabled={isDisabled}
          className={cn(s.icon, "rounded-l-none shadow-none p-0")}
          onClick={() => navigateDay(1)}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      )}
    </div>
  )
}

export { DatePicker }
export type {
  DatePickerLanguage,
  DatePickerMarkedDate,
  DatePickerMarkerKind,
  DatePickerProps,
}
