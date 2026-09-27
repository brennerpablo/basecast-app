"use client";

import { Factory, type LucideIcon, Server, Thermometer, TrendingUp, Zap } from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";
import { PageHeader } from "@/components/product/page-header";

import { FourCpTab } from "./four-cp-tab";
import { LargeLoadsTab } from "./large-loads-tab";
import { NormalizedTab } from "./normalized-tab";
import { PeakTab } from "./peak-tab";
import { QueueTab } from "./queue-tab";

const TABS: { value: string; label: string; icon: LucideIcon; content: React.ReactNode }[] = [
  { value: "peak", label: "Peak", icon: TrendingUp, content: <PeakTab /> },
  { value: "large-loads", label: "Large loads", icon: Server, content: <LargeLoadsTab /> },
  { value: "queue", label: "Generation queue", icon: Factory, content: <QueueTab /> },
  { value: "normalized", label: "Normalized load", icon: Thermometer, content: <NormalizedTab /> },
  { value: "4cp", label: "4CP", icon: Zap, content: <FourCpTab /> },
];

/**
 * /forecast, as a Fundsys dashboard: the title, then one line tab with its icon per part (`?tab=`): the summer
 * peak and the large loads behind it, the generation queue's curves, the weather-normalized load and the 4CP.
 * Each tab lays out its own filters, stat cards and charts, with the provenance once at its foot.
 */
export function ForecastScreen() {
  return (
    <div className="space-y-6">
      <PageHeader title="Forecast" />
      <Tabs urlParam="tab" defaultValue="peak" className="space-y-6">
        <TabsList variant="line" color="brand" className="max-w-full overflow-x-auto">
          {TABS.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="shrink-0">
              <Icon className="mr-1.5 size-3.5" aria-hidden />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map(({ value, content }) => (
          <TabsContent key={value} value={value}>
            {content}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
