"use client";

import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import { Button } from "@/components/ui/button";
import { OPS_RANGES } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { LogsTab } from "./logs-tab";
import { RangeToggle } from "./ops-bits";
import { OverviewTab } from "./overview-tab";
import { PipelinesTab } from "./pipelines-tab";
import { RequestsTab } from "./requests-tab";

/**
 * /ops, laid out like the Fundsys admin screens (data pipelines, logs): line tabs in the brand color, one range for
 * every tab, KPI cards, charts and tables in cards, details in a side sheet. The tab, the range and
 * the filters live in the URL, so a view can be linked to and survives a reload.
 */
export function OpsScreen() {
  const [range, setRange] = useQueryState("range", parseAsStringLiteral(OPS_RANGES).withDefault("24h"));
  const queryClient = useQueryClient();
  const fetching = useIsFetching({ queryKey: ["ops"] }) > 0;

  return (
    <Tabs urlParam="tab" defaultValue="overview" className="space-y-6">
      <TabsList variant="line" color="brand">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="requests">Requests</TabsTrigger>
        <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
      </TabsList>

      <div className="flex flex-wrap items-center gap-3">
        <RangeToggle value={range} onChange={(r) => void setRange(r === "24h" ? null : r)} />
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={fetching}
          aria-busy={fetching}
          onClick={() => void queryClient.invalidateQueries({ queryKey: ["ops"] })}
        >
          <RefreshCw className={cn("mr-1.5 size-3.5", fetching && "animate-spin motion-reduce:animate-none")} />
          {fetching ? "Updating…" : "Refresh"}
        </Button>
      </div>

      <TabsContent value="overview"><OverviewTab range={range} /></TabsContent>
      <TabsContent value="requests"><RequestsTab range={range} /></TabsContent>
      <TabsContent value="pipelines"><PipelinesTab range={range} /></TabsContent>
      <TabsContent value="logs"><LogsTab range={range} /></TabsContent>
    </Tabs>
  );
}
