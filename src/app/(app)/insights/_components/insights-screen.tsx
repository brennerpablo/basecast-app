"use client";

import { Layers, type LucideIcon, Star } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import { CaveatBadges } from "@/components/product/caveat-badges";
import { QueryBody } from "@/components/product/data-card";
import { PageHeader } from "@/components/product/page-header";
import { Provenance } from "@/components/product/provenance";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";

import { type Insight, InsightCard } from "./insight-card";

type InsightsData = components["schemas"]["InsightsData"];

/** The two tabs: grade A as the headline, the rest as the supporting findings. */
const TABS: { value: string; label: string; icon: LucideIcon; pick: (card: Insight) => boolean; headline?: boolean }[] = [
  { value: "headline", label: "Headline", icon: Star, pick: (card) => card.grade === "A", headline: true },
  { value: "supporting", label: "Supporting", icon: Layers, pick: (card) => card.grade !== "A" },
];

function InsightsSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-60 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * /insights: the headline numbers of the video as a dashboard, each finding a full-width card with its
 * caveat and the screen that backs it, in two line tabs (`?tab=`): grade A as the headline findings, the rest
 * as the supporting ones. The response's caveats sit under the page title (and not again on a card) and its
 * provenance at the foot.
 */
export function InsightsScreen() {
  const query = useProductQuery<InsightsData>("insights");
  const meta = query.data?.meta;
  const pageCaveats = meta?.caveats?.map((caveat) => caveat.code);
  return (
    <div className="space-y-6">
      <PageHeader title="Insights">
        <CaveatBadges caveats={meta?.caveats} />
      </PageHeader>
      <QueryBody<InsightsData>
        query={query}
        compact={false}
        isEmpty={(d) => d.cards.length === 0}
        empty={{ title: "No insight yet" }}
        skeleton={<InsightsSkeleton />}
      >
        {(data) => (
          // The API's order within each tab: it changes as marts land, so the app never re-sorts or numbers the cards.
          <Tabs urlParam="tab" defaultValue="headline" className="space-y-6">
            <TabsList variant="line" color="brand" className="max-w-full overflow-x-auto">
              {TABS.map(({ value, label, icon: Icon, pick }) => (
                <TabsTrigger key={value} value={value} className="shrink-0">
                  <Icon className="mr-1.5 size-3.5" aria-hidden />
                  {label}
                  <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">{data.cards.filter(pick).length}</span>
                </TabsTrigger>
              ))}
            </TabsList>
            {TABS.map(({ value, pick, headline }) => {
              const cards = data.cards.filter(pick);
              return (
                <TabsContent key={value} value={value} className="space-y-4">
                  {cards.length ? (
                    cards.map((card) => <InsightCard key={card.id} card={card} headline={headline} omitCaveats={pageCaveats} />)
                  ) : (
                    <p className="text-sm text-muted-foreground">No finding here yet.</p>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </QueryBody>
      {meta && <Provenance meta={meta} className="border-t border-border pt-3" />}
    </div>
  );
}
