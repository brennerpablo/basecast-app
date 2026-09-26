"use client";

import type { Row } from "@tanstack/react-table";
import Link from "next/link";

import type { ColumnMetadata } from "@/components/components-app/data-table";
import { AppBadge } from "@/components/components-app/ui/badge";
import { SimulatedBadge } from "@/components/product/caveat-badges";
import { formatDate, formatWhole, GAP } from "@/components/product/format";
import { ACCOUNT_TYPE_LABEL, type AccountSummary } from "@/lib/accounts/labels";

import { ACTION_ORDER, FlagIcons, NextActionBadge, ScoreBar, TopTrigger, TriggerChips } from "./account-bits";

/** Sorts a nullable text column with the empty cells last. */
function textNullsLast(a: Row<AccountSummary>, b: Row<AccountSummary>, id: string): number {
  const x = a.getValue<string | null>(id);
  const y = b.getValue<string | null>(id);
  if (x === y) return 0;
  if (x === null || x === undefined) return 1;
  if (y === null || y === undefined) return -1;
  return x.localeCompare(y);
}

const muted = (text: string | null | undefined) =>
  text ? <span className="text-xs">{text}</span> : <span className="text-muted-foreground">{GAP}</span>;

/** The /accounts table. `rankScope` picks the rank shown: over every account, or within the account's type. */
export function accountColumns(rankScope: "all" | "within_type"): ColumnMetadata<AccountSummary>[] {
  const withinType = rankScope === "within_type";
  return [
    {
      columnId: "rank",
      title: withinType ? "Rank in type" : "Rank",
      type: "number",
      sortable: true,
      aligned: "right",
      columnClassName: "w-16",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{withinType ? row.original.rank_within_type : row.original.rank}</span>
      ),
    },
    {
      columnId: "name",
      title: "Account",
      type: "text",
      sortable: true,
      hideable: false,
      columnClassName: "min-w-52",
      cell: ({ row }) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <Link
            href={`/accounts/${encodeURIComponent(row.original.account_id)}`}
            className="font-medium text-foreground hover:text-basecast-brand hover:underline"
          >
            {row.original.name}
          </Link>
          <SimulatedBadge simulated={row.original.simulated} />
        </span>
      ),
    },
    {
      columnId: "account_type",
      title: "Type",
      type: "text",
      sortable: true,
      formatter: (value) => ACCOUNT_TYPE_LABEL[value as AccountSummary["account_type"]] ?? String(value),
    },
    {
      columnId: "tier",
      title: "Tier",
      type: "text",
      sortable: true,
      aligned: "center",
      cell: ({ row }) => (
        <AppBadge state="meta" square>
          {row.original.tier}
        </AppBadge>
      ),
    },
    {
      columnId: "score",
      title: "Score",
      type: "number",
      sortable: true,
      cell: ({ row }) => <ScoreBar score={row.original.score} />,
    },
    {
      columnId: "next_action",
      title: "Next action",
      type: "text",
      sortable: true,
      sortingFn: (a, b) => ACTION_ORDER.indexOf(a.original.next_action) - ACTION_ORDER.indexOf(b.original.next_action),
      cell: ({ row }) => <NextActionBadge action={row.original.next_action} />,
    },
    {
      columnId: "action_changes_on",
      title: "Until",
      description: "The day the action lapses unless a new event lands.",
      type: "text",
      sortable: true,
      sortingFn: textNullsLast,
      cell: ({ row }) =>
        row.original.action_changes_on ? (
          <span className="text-xs whitespace-nowrap">until {formatDate(row.original.action_changes_on)}</span>
        ) : (
          <span className="text-muted-foreground">{GAP}</span>
        ),
    },
    {
      columnId: "top_trigger",
      title: "Top trigger",
      type: "text",
      cell: ({ row }) => <TopTrigger trigger={row.original.top_trigger} />,
    },
    {
      columnId: "active_triggers",
      title: "Active triggers",
      type: "text",
      columnClassName: "min-w-64 whitespace-normal",
      cell: ({ row }) => <TriggerChips triggers={row.original.active_triggers} />,
    },
    {
      columnId: "gt",
      title: "G&T",
      type: "text",
      sortable: true,
      sortingFn: textNullsLast,
      columnClassName: "min-w-44 max-w-56 whitespace-normal",
      cell: ({ row }) => muted(row.original.gt),
    },
    {
      columnId: "primary_weather_zone",
      title: "Zone",
      type: "text",
      sortable: true,
      sortingFn: textNullsLast,
      cell: ({ row }) => muted(row.original.primary_weather_zone),
    },
    {
      columnId: "meters",
      title: "Meters",
      type: "number",
      sortable: true,
      aligned: "right",
      formatter: (value) => <span className="tabular-nums">{formatWhole(value as number | null)}</span>,
    },
    {
      columnId: "flags",
      title: "Flags",
      type: "text",
      cell: ({ row }) => <FlagIcons flags={row.original.flags} />,
    },
  ];
}
