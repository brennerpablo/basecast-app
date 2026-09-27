"use client";

import type * as React from "react";

import { type FactLike, FactValue } from "@/components/product/fact-value";
import { cn } from "@/lib/utils";

/**
 * One headline number inside a card: label, the value as a Fact (source and date one hover away, the
 * "Machine-read, not verified" badge beside it), a caption, and badges of its own.
 */
export function StatTile({
  label,
  fact,
  format,
  caption,
  badges,
  swatch,
  className,
}: {
  label: React.ReactNode;
  fact: FactLike;
  format?: React.ComponentProps<typeof FactValue>["format"];
  caption?: React.ReactNode;
  badges?: React.ReactNode;
  /** The mark this number is in the chart below, as its key. */
  swatch?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {swatch}
        {label}
      </p>
      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        <FactValue fact={fact} format={format} valueClassName="text-xl leading-tight font-semibold text-foreground" />
        {badges}
      </div>
      {caption && <div className="mt-1 text-xs text-muted-foreground">{caption}</div>}
    </div>
  );
}
