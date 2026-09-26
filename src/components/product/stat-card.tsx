"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { Card } from "@/components/components-app/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Caveat } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import { CaveatBadges } from "./caveat-badges";
import { type FactLike, FactValue } from "./fact-value";

/**
 * One number as a card: label, value with its unit, caption, caveats and a link to the screen that backs
 * it. The value is a Fact, so its source and date are one hover away and a missing value shows as a gap.
 */
export function StatCard({
  label,
  fact,
  format,
  caption,
  caveats,
  href,
  hrefLabel = "Open",
  accent,
  isLoading,
  className,
}: {
  label: React.ReactNode;
  fact: FactLike;
  format?: React.ComponentProps<typeof FactValue>["format"];
  caption?: React.ReactNode;
  caveats?: Caveat[] | null;
  href?: string;
  hrefLabel?: string;
  /** Left accent color, as the KPI cards. */
  accent?: string;
  isLoading?: boolean;
  className?: string;
}) {
  return (
    <Card accentColor={accent} accentSide="left" className={cn("flex h-full flex-col", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      {isLoading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <FactValue
          fact={fact}
          format={format}
          className="mt-1.5"
          valueClassName="text-2xl leading-tight font-semibold text-foreground"
        />
      )}
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}
      <CaveatBadges caveats={caveats} className="mt-3" />
      {href && (
        <Link
          href={href}
          className="mt-auto inline-flex items-center gap-1 self-start pt-3 text-xs font-medium text-basecast-brand hover:underline"
        >
          {hrefLabel}
          <ArrowRight className="size-3" aria-hidden />
        </Link>
      )}
    </Card>
  );
}
