"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/components-app/ui/tabs";

import { LargeLoadsTab } from "./large-loads-tab";
import { PeakTab } from "./peak-tab";

/** /forecast: the summer peak and the large loads behind it, one tab each (`?tab=`). */
export function ForecastScreen() {
  return (
    <Tabs urlParam="tab" defaultValue="peak" className="space-y-6">
      <TabsList variant="line" color="brand">
        <TabsTrigger value="peak">Peak</TabsTrigger>
        <TabsTrigger value="large-loads">Large loads</TabsTrigger>
      </TabsList>
      <TabsContent value="peak">
        <PeakTab />
      </TabsContent>
      <TabsContent value="large-loads">
        <LargeLoadsTab />
      </TabsContent>
    </Tabs>
  );
}
