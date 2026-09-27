"use client";

import { Download, TriangleAlert, X } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useMemo } from "react";

import { DataTable } from "@/components/components-app/data-table";
import { FilterChipMultiselect, FilterClearButton, FilterSearchInput } from "@/components/components-app/url-filters";
import { CaveatBadges } from "@/components/product/caveat-badges";
import { DashboardStatCard } from "@/components/product/dashboard-stat-card";
import { QueryBody } from "@/components/product/data-card";
import { formatWhole } from "@/components/product/format";
import { PageHeader } from "@/components/product/page-header";
import { Provenance } from "@/components/product/provenance";
import SkeletonDatatable from "@/components/skeleton-datatable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  accountsApiParams,
  accountsFilterParsers,
  hasActiveFilters,
  LIST_FILTERS,
  type ListFilter,
} from "@/lib/accounts/filters";
import {
  ACCOUNT_TYPE_LABEL,
  type AccountsData,
  type AccountSummary,
  type CodeKind,
  type NextAction,
  useCodeLabels,
} from "@/lib/accounts/labels";
import { ACTION_ORDER, countByAction } from "@/lib/accounts/summary";
import type { components } from "@/lib/api/get-data";
import { useProductQuery } from "@/lib/bff/queries";
import { dataUrl } from "@/lib/bff/url";

import { ACTION_ICON } from "./account-bits";
import { accountColumns } from "./accounts-columns";

type CountyDetail = components["schemas"]["CountyDetail"];

const FILTER_LABEL: Record<ListFilter, string> = {
  type: "Type",
  tier: "Tier",
  action: "Next action",
  trigger: "Trigger",
  zone: "Zone",
  gt: "G&T",
};

const distinct = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));

/** Each list filter's choices, from the unfiltered list: the app keeps no list of triggers, zones or G&Ts. */
function filterOptions(
  items: AccountSummary[],
  codeLabel: (kind: CodeKind, code: string) => string,
): Record<ListFilter, { value: string; label: string }[]> {
  const actions = [...new Set(items.map((i) => i.next_action))].sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
  return {
    type: distinct(items.map((i) => i.account_type)).map((v) => ({
      value: v,
      label: ACCOUNT_TYPE_LABEL[v as AccountSummary["account_type"]] ?? v,
    })),
    tier: distinct(items.map((i) => i.tier)).map((v) => ({ value: v, label: `Tier ${v}` })),
    action: actions.map((v) => ({ value: v, label: codeLabel("next_action", v) })),
    trigger: distinct(items.flatMap((i) => i.active_triggers)).map((v) => ({ value: v, label: codeLabel("trigger", v) })),
    zone: distinct(items.map((i) => i.primary_weather_zone)).map((v) => ({ value: v, label: v })),
    gt: distinct(items.map((i) => i.gt)).map((v) => ({ value: v, label: v })),
  };
}

const FIPS = /^\d{5}$/;

/** A removable chip for the county the Explorer sent (`?county=`), named once get-data answers. */
function CountyChip({ fips, onRemove }: { fips: string; onRemove: () => void }) {
  const county = useProductQuery<CountyDetail>(`geo/counties/${fips}`, undefined, { throwOnError: false });
  const name = county.data?.data.county_name;
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label="Remove the county filter"
      className="inline-flex items-center gap-1.5 rounded-md border border-basecast-brand-border bg-basecast-brand-surface px-2 py-1.5 text-xs font-medium whitespace-nowrap hover:bg-muted"
    >
      <span className="text-muted-foreground">County</span>
      <span className="h-4 w-px bg-border" />
      <span className="text-basecast-brand">{name ? `${name} (${fips})` : fips}</span>
      <X className="size-3.5 text-muted-foreground" aria-hidden />
    </button>
  );
}

/**
 * One stat card per next action, counted over the whole ranking (not the filtered list), as Fundsys's list
 * KPIs. A card is a quick filter: it narrows the list to its action, and clicking it again clears it.
 */
function ActionCards({
  items,
  selected,
  onSelect,
}: {
  items: AccountSummary[] | undefined;
  selected: string[];
  onSelect: (action: NextAction | null) => void;
}) {
  const { label } = useCodeLabels();
  const counts = countByAction(items ?? []);
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {ACTION_ORDER.map((action) => {
        const Icon = ACTION_ICON[action];
        const active = selected.length === 1 && selected[0] === action;
        return (
          <DashboardStatCard
            key={action}
            icon={<Icon className="size-4" aria-hidden />}
            title={label("next_action", action)}
            value={formatWhole(counts[action])}
            isLoading={!items}
            isActive={active}
            onClick={() => onSelect(active ? null : action)}
          />
        );
      })}
    </div>
  );
}

/**
 * /accounts: the co-ops and munis ranked by the API, filtered through the URL, with the CSV of the same filters.
 * Laid out as Fundsys's CRM list: the title with the actions on the right, the stat cards, the table on its own.
 */
export function AccountsScreen() {
  const [filters, setFilters] = useQueryStates(accountsFilterParsers);
  const county = filters.county && FIPS.test(filters.county) ? filters.county : null;
  const params = accountsApiParams({ ...filters, county });

  const list = useProductQuery<AccountsData>("accounts", params, { keepPrevious: true });
  // The unfiltered list: the filters' choices and the universe count. The same entry as `list` without filters.
  const universe = useProductQuery<AccountsData>("accounts", undefined, { throwOnError: false });
  const { label: codeLabel } = useCodeLabels();
  const options = filterOptions(universe.data?.data.items ?? [], codeLabel);
  const columns = useMemo(() => accountColumns(filters.rank), [filters.rank]);

  const pendingWeights = list.data?.meta.caveats?.find((c) => c.code === "weights_pending_review");
  const shown = list.data?.data.total;
  const all = universe.data?.data.total;

  const clearAll = () =>
    void setFilters({ type: null, tier: null, action: null, trigger: null, zone: null, gt: null, q: null, county: null });

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSearchInput
        value={filters.q}
        onValueChange={(q) => void setFilters({ q })}
        placeholder="Search accounts"
        className="h-8 w-48 text-xs"
      />
      {county && <CountyChip fips={county} onRemove={() => void setFilters({ county: null })} />}
      {LIST_FILTERS.map((name) => (
        <FilterChipMultiselect
          key={name}
          idPrefix="accounts"
          field={name}
          label={FILTER_LABEL[name]}
          options={options[name]}
          selectedValues={filters[name]}
          onApply={(values) => void setFilters({ [name]: values.length ? values : null })}
          onReset={() => void setFilters({ [name]: null })}
        />
      ))}
      {hasActiveFilters({ ...filters, county }) && <FilterClearButton onClick={clearAll} />}
    </div>
  );

  // A view option, not a filter: the same accounts, ordered by their rank within co-ops and within munis.
  const rankToggle = (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
      <Switch
        checked={filters.rank === "within_type"}
        onCheckedChange={(on) => void setFilters({ rank: on ? "within_type" : null })}
      />
      Rank munis within type
    </label>
  );

  const exportButton = (
    <Button variant="outline" size="sm" asChild className="gap-x-2 px-2 py-1.5 text-xs">
      <a href={dataUrl("accounts/export.csv", params)} download>
        <Download aria-hidden />
        Export CSV
      </a>
    </Button>
  );

  const meta = list.data?.meta;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Accounts"
        subtitle={
          shown === undefined
            ? "Co-ops and munis ranked by priority."
            : `${formatWhole(shown)}${all !== undefined && all !== shown ? ` of ${formatWhole(all)}` : ""} co-ops and munis${filters.rank === "within_type" ? ", ranked within their type" : ", ranked by priority"}.`
        }
        actions={
          <>
            {rankToggle}
            {exportButton}
          </>
        }
      >
        <CaveatBadges caveats={meta?.caveats?.filter((caveat) => caveat.code !== "weights_pending_review")} />
      </PageHeader>
      {pendingWeights && (
        <Alert className="border-yellow-600/40 bg-yellow-50 text-yellow-950 dark:border-yellow-800/45 dark:bg-yellow-950/30 dark:text-yellow-100 [&>svg]:text-yellow-700 dark:[&>svg]:text-yellow-300">
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>{pendingWeights.label}</AlertTitle>
          <AlertDescription className="text-sm">{pendingWeights.text}</AlertDescription>
        </Alert>
      )}
      <ActionCards
        items={universe.data?.data.items}
        selected={filters.action}
        onSelect={(action) => void setFilters({ action: action ? [action] : null })}
      />
      <QueryBody<AccountsData> query={list} compact={false} skeleton={<SkeletonDatatable />}>
        {(data) => (
          <DataTable<AccountSummary>
            columnsMetadata={columns}
            data={data.items}
            tableName="accounts"
            language="en"
            bordered
            compact
            enablePagination={false}
            enableDownload={false}
            toolbarIconsOnly
            filterExtras={filterBar}
            fetching={list.isFetching && list.isPlaceholderData}
            getRowId={(row) => row.account_id}
          />
        )}
      </QueryBody>
      {meta && <Provenance meta={meta} className="border-t border-border pt-3" />}
    </div>
  );
}
