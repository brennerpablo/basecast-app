import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { ForecastScreen } from "./_components/forecast-screen";

/** Forecast: the summer peak by layer against ERCOT's official lines, and the large loads behind it. */
export default function ForecastPage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: "Forecast" }]} />
      <ForecastScreen />
    </>
  );
}
