import { Activity } from "lucide-react";

import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { OpsScreen } from "./_components/ops-screen";

/** Ops: logs, requests, errors and pipeline runs of the app, get-data and airflow (`ops.log`). */
export default function OpsPage() {
  return (
    <div className="space-y-6">
      <PageBreadcrumb items={[{ label: "Ops" }]} />

      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
          <Activity className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Ops</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Requests, errors, pipeline runs and logs of the app, get-data and airflow.
          </p>
        </div>
      </div>

      <OpsScreen />
    </div>
  );
}
