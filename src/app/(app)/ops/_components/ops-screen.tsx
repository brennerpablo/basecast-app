"use client";

import { useIsFetching } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import { OPS_RANGES } from "@/lib/ops/types";
import { cn } from "@/lib/utils";

import { LogsTab } from "./logs-tab";
import { OPS_REFETCH_MS } from "./ops-bits";
import { OverviewTab } from "./overview-tab";
import { PipelinesTab } from "./pipelines-tab";
import { RequestsTab } from "./requests-tab";
import { Segmented } from "./segmented";

/**
 * /ops: what the app, get-data and the pipelines are doing, from `ops.log` and `etl_run`. The tab,
 * the range and every filter live in the URL, so a view can be linked to and survives a reload.
 */
export function OpsScreen() {
  const [range, setRange] = useQueryState("range", parseAsStringLiteral(OPS_RANGES).withDefault("24h"));
  const fetching = useIsFetching({ queryKey: ["ops"] }) > 0;

  return (
    <Tabs defaultValue="overview" urlParam="tab" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Segmented
            label="Time range"
            options={OPS_RANGES.map((r) => ({ value: r, label: r }))}
            value={range}
            onChange={(r) => void setRange(r === "24h" ? null : r)}
          />
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={cn("size-2 rounded-full bg-emerald-500", fetching && "animate-pulse motion-reduce:animate-none")}
              aria-hidden
            />
            Updates every {OPS_REFETCH_MS / 1_000} s
          </span>
        </div>
      </div>
      <TabsContent value="overview"><OverviewTab range={range} /></TabsContent>
      <TabsContent value="requests"><RequestsTab range={range} /></TabsContent>
      <TabsContent value="pipelines"><PipelinesTab range={range} /></TabsContent>
      <TabsContent value="logs"><LogsTab range={range} /></TabsContent>
    </Tabs>
  );
}
