"use client";

import { BadgeCheck, Factory, History, Map as MapIcon, Server, TrendingUp, TriangleAlert, Zap } from "lucide-react";

import { AppBadge } from "@/components/components-app/ui/badge";
import { Card } from "@/components/components-app/ui/card";
import { CaveatBadges } from "@/components/product/caveat-badges";
import { CardOpenLink, DashboardCardHeader } from "@/components/product/dashboard-card-header";
import { formatValue } from "@/components/product/format";
import { KpiItem } from "@/components/product/kpi-item";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { components } from "@/lib/api/get-data";
import { cn } from "@/lib/utils";

export type Insight = components["schemas"]["InsightsData"]["cards"][number];

const QUEUE_LABEL: Record<NonNullable<Insight["queue"]>, string> = {
  generation: "Generation queue",
  large_load: "Large-load queue",
};

/** The screen a link lands on, named for its button. */
export function destination(link: string): string {
  if (link.startsWith("/backtest")) return "Open Backtest";
  if (link.startsWith("/explorer")) return "Open Explorer";
  if (link.startsWith("/accounts")) return "Open Accounts";
  if (link.startsWith("/forecast")) return "Open Forecast";
  return "Open";
}

type Topic = "large_load" | "generation" | "4cp" | "backtest" | "explorer" | "other";

/** What the card speaks of, for its icon: the queue, else the screen behind it. */
export function topic(card: Pick<Insight, "queue" | "link">): Topic {
  if (card.queue) return card.queue;
  const link = card.link ?? "";
  if (link.includes("tab=4cp")) return "4cp";
  if (link.startsWith("/backtest")) return "backtest";
  if (link.startsWith("/explorer")) return "explorer";
  return "other";
}

function TopicIcon({ card }: { card: Insight }) {
  const props = { className: "size-5", "aria-hidden": true, "data-topic": topic(card) };
  switch (topic(card)) {
    case "large_load":
      return <Server {...props} />;
    case "generation":
      return <Factory {...props} />;
    case "4cp":
      return <Zap {...props} />;
    case "backtest":
      return <History {...props} />;
    case "explorer":
      return <MapIcon {...props} />;
    default:
      return <TrendingUp {...props} />;
  }
}

/**
 * One finding as a full-width dashboard card: the header (icon, title, id and queue, "Re-derived" when
 * `verified`, the link to the screen that backs it), the value and caption beside the companion figures,
 * and a footer with the caveat its line must always carry, the caveat badges and the source doc. A
 * headline (grade A) card carries the brand accent on its left edge.
 */
export function InsightCard({ card, headline }: { card: Insight; headline?: boolean }) {
  const figures = card.figures ?? [];
  return (
    <Card
      data-insight={card.id}
      accentColor={headline ? "hsl(var(--brand))" : undefined}
      accentSide="left"
      className="min-w-0"
    >
      <DashboardCardHeader
        icon={<TopicIcon card={card} />}
        title={card.title}
        subtitle={card.queue ? `${card.id} · ${QUEUE_LABEL[card.queue]}` : card.id}
        trailing={
          (card.verified || card.link) && (
            <>
              {card.verified && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AppBadge state="active" tabIndex={0} className="cursor-help gap-1">
                      <BadgeCheck aria-hidden />
                      {/* Only the check on a phone, so the title keeps the width. */}
                      <span className="max-sm:sr-only">Re-derived</span>
                    </AppBadge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">Re-derived from the source data by an independent check (X6).</TooltipContent>
                </Tooltip>
              )}
              {card.link && <CardOpenLink href={card.link} label={destination(card.link)} />}
            </>
          )
        }
      />
      <div className={cn("mt-6 grid gap-x-10 gap-y-5", figures.length > 0 && "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}>
        <div className="min-w-0">
          <p className="text-3xl leading-none font-semibold tracking-[-0.01em] text-foreground tabular-nums">
            {formatValue(card.value, card.unit)}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">{card.caption}</p>
        </div>
        {figures.length > 0 && (
          <div className="grid min-w-0 grid-cols-2 content-start gap-x-6 gap-y-4 sm:grid-cols-3">
            {figures.map((figure) => (
              <KpiItem key={figure.label} label={figure.label} value={formatValue(figure.value, figure.unit)} />
            ))}
          </div>
        )}
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-start md:gap-6">
        <p data-slot="insight-caveat" className="flex min-w-0 flex-1 items-start gap-2 text-xs text-foreground/80">
          <TriangleAlert className="mt-px size-3.5 shrink-0 text-yellow-700 dark:text-yellow-300" aria-hidden />
          <span>{card.caveat}</span>
        </p>
        {(card.caveats?.length || card.source_doc) && (
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 md:max-w-[40%] md:justify-end">
            <CaveatBadges caveats={card.caveats} />
            {card.source_doc && <span className="text-xs text-muted-foreground">{card.source_doc}</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
