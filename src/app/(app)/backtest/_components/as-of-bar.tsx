"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";

import { AppBadge } from "@/components/components-app/ui/badge";
import { formatDate } from "@/components/product/format";
import { InfoTip } from "@/components/product/info-tip";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import type { Era } from "./backtest-data";

/** `May '23`: a backtest date on the slider's scale. */
const short = (date: string) => formatDate(date.slice(0, 7)).replace(/ (\d{2})(\d{2})$/, " '$2");

/**
 * The backtest date as a labeled filter, over the dates the API sends (never a date of our own): it moves our
 * model and the official vintages of that date in the fan, and the one-date view.
 */
export function AsOfBar({
  dates,
  value,
  onChange,
  era,
  pending,
}: {
  dates: string[] | undefined;
  value: string | undefined;
  onChange: (date: string) => void;
  era: Era | undefined;
  /** A new date is loading: the old one stays on screen. */
  pending?: boolean;
}) {
  const index = dates && value ? dates.indexOf(value) : -1;
  const last = (dates?.length ?? 1) - 1;
  return (
    // `Filter`'s markup, with the label's InfoTip beside it (`Filter` takes a plain string label).
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        Backtest date
        <InfoTip label="About the backtest date">The model rerun at each date; leak notes flag any input it took from later.</InfoTip>
      </span>
      <div className="flex flex-col gap-3 rounded-md border border-border bg-card px-4 py-3 lg:flex-row lg:items-center">
      {!dates || index < 0 ? (
        <Skeleton className="h-10 flex-1" />
      ) : (
        <div className="min-w-0 flex-1 px-2">
          <SliderPrimitive.Root
            min={0}
            max={last}
            step={1}
            value={[index]}
            onValueChange={([i]) => dates[i] && dates[i] !== value && onChange(dates[i])}
            aria-label="Backtest date"
            className="relative flex h-5 w-full touch-none items-center select-none"
          >
            <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-secondary">
              <SliderPrimitive.Range className="absolute h-full bg-brand" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb
              aria-label="Backtest date"
              aria-valuetext={formatDate(value)}
              className="block size-5 rounded-full border-2 border-primary bg-background ring-offset-background transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            />
          </SliderPrimitive.Root>
          <div className="relative mt-2 h-4">
            {dates.map((date, i) => (
              <button
                key={date}
                type="button"
                tabIndex={-1}
                onClick={() => onChange(date)}
                style={{ left: `${last ? (i / last) * 100 : 0}%` }}
                className={cn(
                  "absolute top-0 text-[11px] whitespace-nowrap tabular-nums transition-colors hover:text-foreground",
                  i === 0 ? "" : i === last ? "-translate-x-full" : "-translate-x-1/2",
                  i === index ? "font-medium text-foreground" : "text-muted-foreground",
                  i !== 0 && i !== last && i !== index && "hidden sm:block",
                )}
              >
                {short(date)}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className={cn("flex shrink-0 flex-wrap items-center gap-2 transition-opacity lg:w-64 lg:justify-end", pending && "opacity-60")}>
        {value && <span className="text-sm font-medium text-foreground tabular-nums">{formatDate(value)}</span>}
        {era && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="cursor-help">
                <AppBadge state="metadata">{era.label}</AppBadge>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">{era.description}</TooltipContent>
          </Tooltip>
        )}
      </div>
      </div>
    </div>
  );
}
