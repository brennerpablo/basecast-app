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
import type { CaveatCode } from "@/lib/bff/envelope";
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
 * The caveat the finding's line must always carry, as an amber badge (the look of a machine-read
 * `CaveatBadge`) with the text in its tooltip, and for screen readers in the badge itself.
 */
function LineCaveat({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AppBadge state="alert" data-slot="insight-caveat" tabIndex={0} className="cursor-help gap-1">
          <TriangleAlert aria-hidden />
          Caveat
          <span className="sr-only">: {text}</span>
        </AppBadge>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm text-xs">{text}</TooltipContent>
    </Tooltip>
  );
}

/**
 * One finding as a full-width dashboard card: the header (icon, title, queue, "Re-derived" when `verified`,
 * the link to the screen that backs it), the value and caption beside the companion figures, and a footer
 * with the line's caveat and the caveat badges (less `omitCaveats`, the codes the screen already shows over
 * the same response). A headline (grade A) card carries the brand accent on its left edge.
 */
export function InsightCard({ card, headline, omitCaveats }: { card: Insight; headline?: boolean; omitCaveats?: CaveatCode[] }) {
  const figures = card.figures ?? [];
  const caveats = (card.caveats ?? []).filter((caveat) => !omitCaveats?.includes(caveat.code));
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
        subtitle={card.queue ? QUEUE_LABEL[card.queue] : undefined}
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
                  <TooltipContent className="max-w-xs text-xs">Re-derived from the source data by an independent check.</TooltipContent>
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
      {(card.caveat || caveats.length > 0) && (
        <div className="mt-6 flex flex-wrap items-center gap-1.5 border-t border-border pt-4">
          {card.caveat && <LineCaveat text={card.caveat} />}
          <CaveatBadges caveats={caveats} className="contents" />
        </div>
      )}
    </Card>
  );
}
