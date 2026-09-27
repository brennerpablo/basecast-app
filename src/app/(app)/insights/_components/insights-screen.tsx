"use client";

import { ArrowRight, BadgeCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";

import { AppBadge } from "@/components/components-app/ui/badge";
import { Card } from "@/components/components-app/ui/card";
import { CaveatBadges } from "@/components/product/caveat-badges";
import { DataCard } from "@/components/product/data-card";
import { formatValue } from "@/components/product/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { cn } from "@/lib/utils";

type InsightsData = components["schemas"]["InsightsData"];
type Insight = InsightsData["cards"][number];

const QUEUE_LABEL: Record<NonNullable<Insight["queue"]>, string> = {
  generation: "Generation queue",
  large_load: "Large-load queue",
};

/** The screen a link lands on, named for its button. */
function destination(link: string): string {
  if (link.startsWith("/backtest")) return "Backtest";
  if (link.startsWith("/explorer")) return "Explorer";
  if (link.startsWith("/accounts")) return "Accounts";
  if (link.startsWith("/forecast")) return "Forecast";
  return "Open";
}

/**
 * One headline number: value and caption, its companion figures, the caveat its line must always carry,
 * the caveat badges, which queue it speaks of, and the screen that backs it.
 */
function InsightCard({ card, hero }: { card: Insight; hero?: boolean }) {
  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3">
        <p className={cn("font-medium text-foreground", hero ? "text-base" : "text-sm")}>{card.title}</p>
        <span className="flex shrink-0 items-center gap-1.5">
          {card.queue && <AppBadge state="info">{QUEUE_LABEL[card.queue]}</AppBadge>}
          {card.verified && (
            <Tooltip>
              <TooltipTrigger asChild>
                <AppBadge state="active" tabIndex={0} className="cursor-help gap-1">
                  <BadgeCheck aria-hidden />
                  Re-derived
                </AppBadge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">Re-derived from the source data by an independent check (X6).</TooltipContent>
            </Tooltip>
          )}
        </span>
      </div>
      <p className={cn("mt-2 leading-none font-semibold text-foreground tabular-nums", hero ? "text-4xl" : "text-3xl")}>
        {formatValue(card.value, card.unit)}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{card.caption}</p>
      {card.figures && card.figures.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
          {card.figures.map((figure) => (
            <div key={figure.label}>
              <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{figure.label}</dt>
              <dd className="text-sm font-medium tabular-nums">{formatValue(figure.value, figure.unit)}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 flex items-start gap-1.5 rounded-md bg-muted/60 px-2.5 py-2 text-xs text-foreground/80">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-yellow-700 dark:text-yellow-300" aria-hidden />
        {card.caveat}
      </p>
      <CaveatBadges caveats={card.caveats} className="mt-3" />
      <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-xs">
        <span className="truncate text-muted-foreground" title={card.source_doc ?? undefined}>
          {card.id}
          {card.source_doc ? ` · ${card.source_doc}` : ""}
        </span>
        {card.link && (
          <Link href={card.link} className="inline-flex shrink-0 items-center gap-1 font-medium text-basecast-brand hover:underline">
            {destination(card.link)} <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
    </Card>
  );
}

/** /insights: the headline numbers of the video, each with its caveat and the screen that backs it. */
export function InsightsScreen() {
  const query = useProductQuery<InsightsData>("insights");
  return (
    <DataCard<InsightsData>
      title="Insights"
      subtitle="The findings in one place, strongest first. Every number comes from the marts, with the caveat it needs."
      query={query}
      isEmpty={(d) => d.cards.length === 0}
      empty={{ title: "No insight yet", description: "They appear once the insights mart is built." }}
      skeleton={<Skeleton className="h-96 w-full" />}
    >
      {(data) => {
        // The API's order: it changes as marts land, so the app never re-sorts or numbers the cards.
        const heroes = data.cards.filter((c) => c.grade === "A");
        const rest = data.cards.filter((c) => c.grade !== "A");
        return (
          <div className="space-y-6">
            {heroes.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                {heroes.map((card) => (
                  <InsightCard key={card.id} card={card} hero />
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {rest.map((card) => (
                  <InsightCard key={card.id} card={card} />
                ))}
              </div>
            )}
          </div>
        );
      }}
    </DataCard>
  );
}
