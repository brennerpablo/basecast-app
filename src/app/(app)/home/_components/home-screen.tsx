"use client";

import { Lightbulb } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";

import { QueryBody } from "@/components/product/data-card";
import { formatDate } from "@/components/product/format";
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
import { commonAsOf, HomeAsOfContext } from "./home-card";

type InsightsData = components["schemas"]["InsightsData"];

/** The lead finding, as the Insights screen draws it; nothing when there is no finding yet. */
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
 * The data date most of the cards share, once they have all answered (the same queries as the cards, so no
 * extra request); null until then, so no card flashes a date of its own.
 */
function usePageAsOf(): string | null {
  const queries = [
    useProductQuery("accounts", undefined, { throwOnError: false }),
    useProductQuery("geo/counties", undefined, { throwOnError: false }),
    useProductQuery("forecasts/peak", undefined, { throwOnError: false }),
    useProductQuery("backtest/peak", undefined, { throwOnError: false }),
  ];
  if (queries.some((query) => query.isPending && query.fetchStatus !== "idle")) return null;
  return commonAsOf(queries.map((query) => query.data?.meta.data_as_of));
}

/**
 * /home: one highlight per module, each card over its own query (a view being rebuilt empties only its
 * card): the lead finding, accounts, acquisition priority, the summer peak and the backtest. The data date
 * shows once at the foot; a card whose date differs carries its own.
 */
export function HomeScreen() {
  const { data: session } = useSession();
  const firstName = session?.user?.name?.trim().split(/\s+/)[0];
  const asOf = usePageAsOf();
  return (
    <div className="space-y-6">
      <PageHeader
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
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
      <HomeAsOfContext.Provider value={asOf}>
        <div className="grid gap-4 xl:grid-cols-2">
          <AccountsCard />
          <ExplorerCard />
          <ForecastCard />
          <BacktestCard />
        </div>
      </HomeAsOfContext.Provider>
      {asOf && <p className="border-t border-border pt-3 text-xs text-muted-foreground">As of {formatDate(asOf)}</p>}
    </div>
  );
}
