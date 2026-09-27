"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { Activity, LayoutDashboard, type LucideIcon, RefreshCw, ScrollText, Workflow } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import { Filter } from "@/components/product/filter";
import { PageHeader } from "@/components/product/page-header";
import { Button } from "@/components/ui/button";
import { OPS_RANGES } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { LogsTab } from "./logs-tab";
import { RangeToggle } from "./ops-bits";
import { OverviewTab } from "./overview-tab";
import { PipelinesTab } from "./pipelines-tab";
import { RequestsTab } from "./requests-tab";

const TABS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "overview", label: "Overview", icon: LayoutDashboard },
  { value: "requests", label: "Requests", icon: Activity },
  { value: "pipelines", label: "Pipelines", icon: Workflow },
  { value: "logs", label: "Logs", icon: ScrollText },
];

/**
 * /ops, laid out like the Fundsys admin screens (data pipelines, logs): the title with the range and refresh as its
 * actions, line tabs with icons, one range for every tab, KPI cards, charts and tables in cards, details in a side sheet. The tab, the range and
 * the filters live in the URL, so a view can be linked to and survives a reload.
 */
export function OpsScreen() {
  const [range, setRange] = useQueryState("range", parseAsStringLiteral(OPS_RANGES).withDefault("24h"));
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["ops"] }) > 0;

  const actions = (
    <>
      <Filter label="Range">
        <RangeToggle value={range} onChange={(r) => void setRange(r === "24h" ? null : r)} />
      </Filter>
      <Button
        size="sm"
        variant="outline"
        className="self-end"
        disabled={fetching}
        aria-busy={fetching}
        onClick={() => void queryClient.invalidateQueries({ queryKey: ["ops"] })}
      >
        <RefreshCw className={cn("mr-1.5 size-3.5", fetching && "animate-spin motion-reduce:animate-none")} />
        {fetching ? "Updating…" : "Refresh"}
      </Button>
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ops"
        subtitle="Requests, latency, pipeline runs and log lines of the app, get-data and airflow. Refreshes every 30 s."
        actions={actions}
      />
      <Tabs urlParam="tab" defaultValue="overview" className="space-y-6">
        <TabsList variant="line" color="brand" className="max-w-full overflow-x-auto">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="shrink-0">
              <Icon className="mr-1.5 size-3.5" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="overview"><OverviewTab range={range} /></TabsContent>
        <TabsContent value="requests"><RequestsTab range={range} /></TabsContent>
        <TabsContent value="pipelines"><PipelinesTab range={range} /></TabsContent>
        <TabsContent value="logs"><LogsTab range={range} /></TabsContent>
      </Tabs>
    </div>
  );
}
