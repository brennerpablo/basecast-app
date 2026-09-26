"use client";

import { format } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  CalendarDays,
  ChevronDown
} from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDateOnlyLocal, parseDateOnlyToLocal } from "@/lib/utils/calendar-date";

import { defaultDateRangePresets } from "./presets";
import type { DateRangePreset, DateRangeValue } from "./types";

function toDateRange(value: DateRangeValue | null | undefined): DateRange | undefined {
  if (!value?.from) return undefined;
  const from = parseDateOnlyToLocal(value.from);
  if (!from) return undefined;
  const to = value.to ? parseDateOnlyToLocal(value.to) : undefined;
  return { from, to: to ?? undefined };
}

function fromDateRange(range: DateRange | undefined): DateRangeValue | null {
  if (!range?.from) return null;
  const from = formatDateOnlyLocal(range.from);
  const to = range.to ? formatDateOnlyLocal(range.to) : from;
  return { from, to };
}

export interface DateRangePickerProps {
  /** Valor controlado: { from: YYYY-MM-DD, to: YYYY-MM-DD } */
  value?: DateRangeValue | null;
  /** Chamado ao aplicar intervalo manual, ao limpar, ou ao escolher preset (presets aplicam de imediato). */
  onChange?: (value: DateRangeValue | null) => void;
  /** Faixas rápidas; use `null` em `getRange` para “limpar”. Default: `defaultDateRangePresets`. */
  presets?: DateRangePreset[];
  placeholder?: string;
  className?: string;
  align?: "start" | "center" | "end";
}

export function DateRangePicker({
  value,
  onChange,
  presets = defaultDateRangePresets,
  placeholder = "Select a period",
  className,
  align = "end"}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [range, setRange] = React.useState<DateRange | undefined>(() => toDateRange(value));

  // Fechar sem "Aplicar" (clique fora / Esc) descarta o rascunho do calendário;
  // sem isso o botão exibiria um período que nunca foi entregue ao onChange.
  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setRange(toDateRange(value));
  };

  React.useEffect(() => {
    setRange(toDateRange(value));
    // Mirror the controlled `value` into the popover's draft. We key on
    // primitive from/to strings so equivalent value objects from parent
    // re-renders don't clobber an in-flight edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.from, value?.to]);

  const displayText = React.useMemo(() => {
    if (!range?.from) return placeholder;
    const fromStr = format(range.from, "MM/dd/yyyy", { locale: enUS });
    const toStr = range.to ? format(range.to, "MM/dd/yyyy", { locale: enUS }) : fromStr;
    return range.to && range.from.getTime() !== range.to.getTime()
      ? `${fromStr} – ${toStr}`
      : fromStr;
  }, [range, placeholder]);

  const commitPreset = (preset: DateRangePreset) => {
    const r = preset.getRange();
    if (r == null) {
      setRange(undefined);
      onChange?.(null);
    } else if (r.from) {
      setRange(r);
      onChange?.(fromDateRange(r));
    }
    setOpen(false);
  };

  const apply = () => {
    const next = fromDateRange(range);
    onChange?.(next);
    setOpen(false);
  };

  const clear = () => {
    setRange(undefined);
    onChange?.(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("h-9 justify-start text-left font-normal shadow-xs", className)}
        >
          <CalendarDays className="mr-2 size-4 shrink-0 text-muted-foreground" />
          <span className="flex-1 truncate">{displayText}</span>
          <ChevronDown className="size-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto min-w-95 max-w-[min(440px,90vw)] p-0 bg-popover border border-border rounded-md shadow-md"
        align={align}
      >
        <div className="flex max-h-[min(420px,70vh)]">
          <div className="border-r border-border bg-muted/30 p-2 space-y-0.5 overflow-y-auto shrink-0 w-35">
            {presets.map((preset) => (
              <Button
                key={preset.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm font-normal h-8"
                onClick={() => commitPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-3 flex flex-col flex-1 min-w-55 bg-background">
            <Calendar
              mode="range"
              selected={range}
              onSelect={setRange}
              numberOfMonths={1}
              locale={enUS}
            />
            <div className="flex gap-2 pt-3 border-t border-border shrink-0">
              <Button variant="outline" size="sm" onClick={clear}>
                Clear
              </Button>
              <Button size="sm" onClick={apply}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
