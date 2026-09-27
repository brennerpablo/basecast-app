import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { InsightsScreen } from "./_components/insights-screen";

/** Insights: the headline findings, each with its caveat and a link to the screen that backs it. */
export default function InsightsPage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: "Insights" }]} />
      <InsightsScreen />
    </>
  );
}
