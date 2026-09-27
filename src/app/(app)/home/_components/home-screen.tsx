"use client";

import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { QueryBody } from "@/components/product/data-card";
import { PageHeader } from "@/components/product/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { leadInsight } from "@/lib/home/highlights";

import { InsightCard } from "../../insights/_components/insight-card";
import { AccountsCard } from "./accounts-card";
import { BacktestCard } from "./backtest-card";
import { ExplorerCard } from "./explorer-card";
import { ForecastCard } from "./forecast-card";

type InsightsData = components["schemas"]["InsightsData"];

/** The lead finding, as the Insights screen draws it; nothing when the insights mart has no card. */
function LeadInsight() {
  const query = useProductQuery<InsightsData>("insights", undefined, { throwOnError: false });
  return (
    <QueryBody<InsightsData> query={query} compact={false} skeleton={<Skeleton className="h-60 w-full rounded-lg" />}>
      {(data) => {
        const card = leadInsight(data.cards);
        return card ? <InsightCard card={card} headline={card.grade === "A"} /> : null;
      }}
    </QueryBody>
  );
}

/**
 * /home: one highlight per module, each card over its own query (a mart being rebuilt empties only its
 * card): the lead finding, who to call, where to go, how high the peak goes and how far to trust it.
 */
export function HomeScreen() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        subtitle="Where things stand: the lead finding, who to call, where to go, how high the peak goes and how far to trust it."
        actions={
          <Button variant="outline" size="sm" asChild className="gap-x-2 px-2 py-1.5 text-xs">
            <Link href="/insights">
              <Lightbulb aria-hidden />
              All findings
            </Link>
          </Button>
        }
      />
      <LeadInsight />
      <div className="grid gap-4 xl:grid-cols-2">
        <AccountsCard />
        <ExplorerCard />
        <ForecastCard />
        <BacktestCard />
      </div>
    </div>
  );
}
