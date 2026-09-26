import { History } from "lucide-react";

import { PagePlaceholder } from "../_components/page-placeholder";

export default function BacktestPage() {
  return (
    <PagePlaceholder
      breadcrumb={[{ label: "Backtest" }]}
      Icon={History}
      title="Backtest"
      description="Official forecast, adjusted queue, actual peak and our model, side by side."
    />
  );
}
