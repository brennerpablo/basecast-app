"use client";

import { Building2 } from "lucide-react";
import Link from "next/link";
import type * as React from "react";

import { formatDate, formatWhole } from "@/components/product/format";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCOUNT_TYPE_LABEL, type AccountsData, type AccountSummary, useCodeLabels } from "@/lib/accounts/labels";
import { ACTION_ORDER, countByAction } from "@/lib/accounts/summary";
import { useProductQuery } from "@/lib/bff/queries";
import { callFirst, nextLapses } from "@/lib/home/highlights";

import { ACTION_ICON, NextActionBadge, TopTrigger } from "../../accounts/_components/account-bits";
import { HomeCard } from "./home-card";

function Heading({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">{children}</h4>;
}

/** Name and type · G&T, the name linking to the account's diagnosis. */
function AccountName({ account }: { account: AccountSummary }) {
  return (
    <div className="min-w-0">
      <Link href={`/accounts/${account.account_id}`} className="block truncate text-sm font-medium text-foreground hover:underline">
        {account.name}
      </Link>
      <p className="truncate text-xs text-muted-foreground">
        {[ACCOUNT_TYPE_LABEL[account.account_type] ?? account.account_type, account.gt].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function AccountsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ACTION_ORDER.map((a) => (
          <Skeleton key={a} className="h-14" />
        ))}
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

/**
 * The commercial highlight: how many accounts sit under each next action (each a link to the list filtered
 * by it), the call_now accounts in rank order, and the next actions to lapse after the data date.
 */
export function AccountsCard() {
  const query = useProductQuery<AccountsData>("accounts", undefined, { throwOnError: false });
  const { label } = useCodeLabels();
  const total = query.data?.data.total;
  return (
    <HomeCard<AccountsData>
      icon={Building2}
      title="Who to call"
      subtitle={total === undefined ? "Co-ops and munis ranked by priority." : `${formatWhole(total)} co-ops and munis ranked by priority.`}
      href="/accounts"
      linkLabel="Open Accounts"
      query={query}
      isEmpty={(d) => d.items.length === 0}
      empty={{ title: "No account ranked yet" }}
      skeleton={<AccountsSkeleton />}
    >
      {(data, meta) => {
        const counts = countByAction(data.items);
        const first = callFirst(data.items, 5);
        const lapses = nextLapses(data.items, meta.data_as_of, 4);
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACTION_ORDER.map((action) => {
                const Icon = ACTION_ICON[action];
                return (
                  <Link
                    key={action}
                    href={`/accounts?action=${action}`}
                    className="flex items-center gap-2.5 rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/50"
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-tight text-muted-foreground">{label("next_action", action)}</span>
                      <span className="block text-lg leading-tight font-semibold text-foreground tabular-nums">
                        {formatWhole(counts[action])}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
            <section>
              <Heading>Call first</Heading>
              {first.length ? (
                <ol className="divide-y divide-border">
                  {first.map((account) => (
                    <li key={account.account_id} className="flex items-center gap-3 py-2">
                      <span className="w-7 shrink-0 text-xs text-muted-foreground tabular-nums">#{account.rank}</span>
                      <div className="min-w-0 flex-1">
                        <AccountName account={account} />
                      </div>
                      <span className="shrink-0 max-sm:hidden">
                        <TopTrigger trigger={account.top_trigger} />
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No account to call now.</p>
              )}
            </section>
            {lapses.length > 0 && (
              <section>
                <Heading>Next actions to lapse</Heading>
                <ul className="divide-y divide-border">
                  {lapses.map((account) => (
                    <li key={account.account_id} className="flex items-center gap-3 py-2">
                      <span className="w-24 shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                        {formatDate(account.action_changes_on)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <AccountName account={account} />
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                        <NextActionBadge action={account.next_action} />
                        {account.action_changes_to && (
                          <span className="max-sm:hidden">→ {label("next_action", account.action_changes_to)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        );
      }}
    </HomeCard>
  );
}
