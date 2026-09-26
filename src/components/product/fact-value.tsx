"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Fact } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import { SimulatedBadge, VerifiedBadge } from "./caveat-badges";
import { formatDate, formatValue, GAP } from "./format";

/** A Fact, or any value that carries some of its provenance. */
export type FactLike = Pick<Fact, "value"> & Partial<Omit<Fact, "value">>;

/**
 * A Fact's value, formatted by its unit, with the source, date and note one hover away and the
 * "Simulated" and "Machine-read, not verified" badges beside it. A `null` value shows as a gap, never a zero.
 */
export function FactValue({
  fact,
  format,
  className,
  valueClassName,
}: {
  fact: FactLike;
  /** Overrides the unit-based formatting of a non-null value. */
  format?: (value: NonNullable<Fact["value"]>) => string;
  className?: string;
  valueClassName?: string;
}) {
  const gap = fact.value === null || fact.value === undefined;
  const text = gap ? GAP : format ? format(fact.value!) : formatValue(fact.value, fact.unit);
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-x-1.5 gap-y-1", className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            data-gap={gap || undefined}
            className={cn(
              "cursor-help tabular-nums underline decoration-muted-foreground/40 decoration-dotted underline-offset-4",
              gap && "text-muted-foreground",
              valueClassName,
            )}
          >
            {text}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-xs">
          {fact.label && <p className="font-medium">{fact.label}</p>}
          {gap && <p>No data.</p>}
          <p>Source: {fact.source ?? GAP}</p>
          <p>As of: {formatDate(fact.as_of)}</p>
          {fact.note && <p className="text-muted-foreground">{fact.note}</p>}
        </TooltipContent>
      </Tooltip>
      <SimulatedBadge simulated={fact.simulated} />
      <VerifiedBadge verified={fact.verified} />
    </span>
  );
}
