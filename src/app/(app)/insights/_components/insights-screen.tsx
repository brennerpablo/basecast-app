"use client";

import { CaveatBadges } from "@/components/product/caveat-badges";
import { QueryBody } from "@/components/product/data-card";
import { PageHeader, SectionHeading } from "@/components/product/page-header";
import { Provenance } from "@/components/product/provenance";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";

import { type Insight, InsightCard } from "./insight-card";

type InsightsData = components["schemas"]["InsightsData"];

/** A labeled run of cards, one below the other. */
function InsightSection({ title, cards, headline }: { title: string; cards: Insight[]; headline?: boolean }) {
  if (cards.length === 0) return null;
  return (
    <section className="space-y-3">
      <SectionHeading>{title}</SectionHeading>
      <div className="space-y-4">
        {cards.map((card) => (
          <InsightCard key={card.id} card={card} headline={headline} />
        ))}
      </div>
    </section>
  );
}

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
 * caveat and the screen that backs it. Grade A first under its own heading; the response's caveats sit under
 * the page title and its provenance at the foot.
 */
export function InsightsScreen() {
  const query = useProductQuery<InsightsData>("insights");
  const meta = query.data?.meta;
  return (
    <div className="space-y-8">
      <PageHeader
        title="Insights"
        subtitle="The findings in one place, strongest first. Every number comes from the marts, with the caveat it needs."
      >
        <CaveatBadges caveats={meta?.caveats} />
      </PageHeader>
      <QueryBody<InsightsData>
        query={query}
        compact={false}
        isEmpty={(d) => d.cards.length === 0}
        empty={{ title: "No insight yet", description: "They appear once the insights mart is built." }}
        skeleton={<InsightsSkeleton />}
      >
        {(data) => (
          // The API's order: it changes as marts land, so the app never re-sorts or numbers the cards.
          <div className="space-y-8">
            <InsightSection title="Headline findings" cards={data.cards.filter((c) => c.grade === "A")} headline />
            <InsightSection title="Supporting findings" cards={data.cards.filter((c) => c.grade !== "A")} />
          </div>
        )}
      </QueryBody>
      {meta && <Provenance meta={meta} className="border-t border-border pt-3" />}
    </div>
  );
}
