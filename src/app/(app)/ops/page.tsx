import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { OpsScreen } from "./_components/ops-screen";

/** Ops: logs, requests, errors and pipeline runs of the app, get-data and airflow (`ops.log`). */
export default function OpsPage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: "Ops" }]} />
      <OpsScreen />
    </>
  );
}
