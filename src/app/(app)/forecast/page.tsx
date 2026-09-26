import { TrendingUp } from "lucide-react";

import { PagePlaceholder } from "../_components/page-placeholder";

export default function ForecastPage() {
  return (
    <PagePlaceholder
      breadcrumb={[{ label: "Forecast" }]}
      Icon={TrendingUp}
      title="Peak demand forecast"
      description="Peak MW by region and year (P10/P50/P90), built from queue survival and weather-normalized load."
    />
  );
}
