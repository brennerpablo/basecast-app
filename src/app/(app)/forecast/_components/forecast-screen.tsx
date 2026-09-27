"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";

import { FourCpTab } from "./four-cp-tab";
import { LargeLoadsTab } from "./large-loads-tab";
import { NormalizedTab } from "./normalized-tab";
import { PeakTab } from "./peak-tab";
import { QueueTab } from "./queue-tab";

/**
 * /forecast: the summer peak and the large loads behind it, then the generation queue's curves, the
 * weather-normalized load and the 4CP, one tab each (`?tab=`).
 */
export function ForecastScreen() {
  return (
    <Tabs urlParam="tab" defaultValue="peak" className="space-y-6">
      <TabsList variant="line" color="brand">
        <TabsTrigger value="peak">Peak</TabsTrigger>
        <TabsTrigger value="large-loads">Large loads</TabsTrigger>
        <TabsTrigger value="queue">Generation queue</TabsTrigger>
        <TabsTrigger value="normalized">Normalized load</TabsTrigger>
        <TabsTrigger value="4cp">4CP</TabsTrigger>
      </TabsList>
      <TabsContent value="peak">
        <PeakTab />
      </TabsContent>
      <TabsContent value="large-loads">
        <LargeLoadsTab />
      </TabsContent>
      <TabsContent value="queue">
        <QueueTab />
      </TabsContent>
      <TabsContent value="normalized">
        <NormalizedTab />
      </TabsContent>
      <TabsContent value="4cp">
        <FourCpTab />
      </TabsContent>
    </Tabs>
  );
}
