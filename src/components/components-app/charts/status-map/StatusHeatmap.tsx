"use client"

import { format } from "date-fns"
import { enUS } from "date-fns/locale"
import { Tooltip } from "radix-ui"
import { useLayoutEffect, useMemo, useRef } from "react"

import { cn } from "@/lib/utils"

import {
  buildStatusMapMonthGroups,
  isFirstDateOfMonthGroup,
  resolveShowMonthHeaderRow} from "./status-map-date-header"
import type { StatusMapProps } from "./types"

const LABEL_ALIGN = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end"}

export function StatusMap({
  data,
  labelConfig,
  dateHeader = "auto",
  style = "rounded",
  bordered = true,
  label = true,
  labelAlign = "left",
  labelTop = true,
  showZeroCounts = false,
  rowHeaderWidth,
  className,
  onCellClick,
  onAction,
  tooltip = false,
  initialScroll = "start",
  tooltipContent,
  cellBadge}: StatusMapProps) {
  const { rows, dates, index, counts, monthGroups, showMonthRow } = useMemo(() => {
    const rowsSet = new Set<string>()
    const datesSet = new Set<string>()
    const idx = new Map<string, string>()
    const cnt: Record<string, number> = {}

    for (const entry of data) {
      rowsSet.add(entry.row)
      datesSet.add(entry.date)
      idx.set(`${entry.row}|${entry.date}`, entry.status)
      cnt[entry.status] = (cnt[entry.status] ?? 0) + 1
    }

    const sortedDates = Array.from(datesSet).sort()
    const groups = buildStatusMapMonthGroups(sortedDates)

    return {
      rows: Array.from(rowsSet),
      dates: sortedDates,
      index: idx,
      counts: cnt,
      monthGroups: groups,
      showMonthRow: resolveShowMonthHeaderRow(sortedDates, dateHeader)}
  }, [data, dateHeader])

  const scrollRef = useRef<HTMLDivElement>(null)

  // Numa janela de dias o que interessa é o FIM (os dias mais recentes), e ele
  // é justamente o que fica fora da vista quando o eixo transborda. Layout
  // effect e não effect: depois da pintura o utilizador veria o mapa saltar.
  useLayoutEffect(() => {
    if (initialScroll !== "end") return
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [initialScroll, dates])

  const tight = style === "tight"
  const rounded = style === "rounded"
  const statuses = Object.keys(labelConfig)
  const fallbackStatus = statuses[statuses.length - 1]
  const rowHeaderWidthValue =
    typeof rowHeaderWidth === "number" ? `${rowHeaderWidth}px` : rowHeaderWidth
  const rowHeaderStyle = rowHeaderWidthValue
    ? {
        width: rowHeaderWidthValue,
        minWidth: rowHeaderWidthValue,
        maxWidth: rowHeaderWidthValue,
      }
    : undefined

  // A faixa de rótulos acompanha a rolagem horizontal — sem isto, um eixo que
  // transborda mostra fileiras de células sem dizer de que linha são. As duas
  // classes `status-map-frozen-*` existem porque a célula tem de ser OPACA (as
  // outras rolam por baixo dela) e as cores do tema são translúcidas.
  const cornerThClass = cn(
    "sticky left-0 z-20 pl-6 text-left align-bottom",
    bordered ? "status-map-frozen-head" : "status-map-frozen-label",
    showMonthRow ? "row-span-2 pt-3 pb-2 w-16 min-w-16" : "w-16 pt-3 pb-2",
  )

  const dayThClass = (di: number, monthBorder: boolean) =>
    cn(
      "pb-2 text-center text-xs font-medium text-muted-foreground whitespace-nowrap",
      showMonthRow ? "pt-1" : "pt-3",
      tight ? "min-w-5" : "min-w-7",
      monthBorder && "border-l border-border",
      !tight && di === dates.length - 1 && "pr-6",
    )

  const legend = label && (
    <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-2", LABEL_ALIGN[labelAlign])}>
      {statuses.map((s) => (
        <div key={s} className="flex items-center gap-2">
          <div className={cn("h-3 w-3 rounded-sm", labelConfig[s].color)} />
          <span className="text-xs text-muted-foreground">
            {labelConfig[s].label}
            {(counts[s] != null || showZeroCounts) && (
              <span className="ml-1 font-medium text-foreground">({counts[s] ?? 0})</span>
            )}
          </span>
        </div>
      ))}
    </div>
  )

  const renderStatusCell = (row: string, date: string, di: number, ri: number) => {
    const status = index.get(`${row}|${date}`) ?? fallbackStatus
    const config = labelConfig[status] ?? labelConfig[statuses[0]]
    const isActionable = onAction && config.enableAction
    const { isFirst, groupIndex } = isFirstDateOfMonthGroup(date, monthGroups)
    const monthBorder = showMonthRow && isFirst && groupIndex > 0

    const badge = cellBadge?.(row, date, status) ?? null
const cell = (
      <div
        title={tooltip ? undefined : `${row} · ${date} · ${config.label}`}
        className={cn(
          "relative transition-opacity hover:opacity-75",
          tight ? "h-5 w-full block" : rounded ? "mx-auto h-5 w-5 rounded-sm" : "mx-auto h-5 w-5",
          config.color,
          (onCellClick || isActionable) ? "cursor-pointer" : "cursor-default",
        )}
        onClick={() => {
          onCellClick?.(row, date, status)
          if (isActionable) onAction(row, date, status)
        }}
      >
        {badge}
      </div>
    )

    return (
      <td
        key={date}
        className={cn(
          tight ? "p-0" : "px-1 py-1.5 text-center",
          monthBorder && "border-l border-border",
          !tight && di === dates.length - 1 && "pr-6",
          !tight && ri === rows.length - 1 && "pb-3",
        )}
      >
        {tooltip ? (
          <Tooltip.Root>
            <Tooltip.Trigger asChild>{cell}</Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content
                side="top"
                sideOffset={6}
                className="z-50 rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
              >
                {tooltipContent
                  ? tooltipContent(row, date, status, config.label)
                  : `${row} · ${date} · ${config.label}`}
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>
        ) : (
          cell
        )}
      </td>
    )
  }

  return (
    <Tooltip.Provider delayDuration={0}>
      <div className={cn("space-y-4", className)}>
        {labelTop && legend}

        <div
          ref={scrollRef}
          className={cn(
            "grid-scrollbar overflow-x-auto",
            bordered && "rounded-md border border-border",
          )}
        >
          <table className="w-full border-separate border-spacing-0">
            <thead>
              {showMonthRow ? (
                <>
                  <tr className={cn(bordered && "bg-muted/50")}>
                    <th className={cornerThClass} style={rowHeaderStyle} rowSpan={2} />
                    {monthGroups.map((group, gi) => (
                      <th
                        key={group.key}
                        colSpan={group.dates.length}
                        className={cn(
                          "pt-2.5 pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                          gi > 0 && "border-l border-border",
                          gi === monthGroups.length - 1 && !tight && "pr-6",
                        )}
                      >
                        {group.label}
                      </th>
                    ))}
                  </tr>
                  <tr className={cn("border-b border-border", bordered && "bg-muted/50")}>
                    {dates.map((date, di) => {
                      const { isFirst, groupIndex } = isFirstDateOfMonthGroup(date, monthGroups)
                      return (
                        <th
                          key={date}
                          className={dayThClass(di, isFirst && groupIndex > 0)}
                        >
                          {format(new Date(`${date}T00:00:00`), "d", { locale: enUS })}
                        </th>
                      )
                    })}
                  </tr>
                </>
              ) : (
                <tr className={cn("border-b border-border", bordered && "bg-muted/50")}>
                  <th className={cornerThClass} style={rowHeaderStyle} />
                  {dates.map((date, di) => (
                    <th key={date} className={dayThClass(di, false)}>
                      {format(new Date(`${date}T00:00:00`), "d", { locale: enUS })}
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr
                  key={row}
                  className={cn(
                    !tight && "border-b border-border",
                    !tight && ri === rows.length - 1 && "border-b-0",
                  )}
                >
                  <td
                    title={row}
                    style={rowHeaderStyle}
                    className={cn(
                      "status-map-frozen-label sticky left-0 z-10 whitespace-nowrap pl-6 pr-4 text-xs font-medium text-muted-foreground",
                      rowHeaderWidthValue && "overflow-hidden text-ellipsis",
                      tight ? "py-0" : "py-2",
                      !tight && ri === rows.length - 1 && "pb-3",
                    )}
                  >
                    {row}
                  </td>
                  {dates.map((date, di) => renderStatusCell(row, date, di, ri))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!labelTop && legend}
      </div>
    </Tooltip.Provider>
  )
}
