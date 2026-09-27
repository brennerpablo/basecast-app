import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { BacktestScreen } from "./_components/backtest-screen";

/**
 * Backtest: the peak model rerun at past dates against ERCOT's official forecasts and the actual, the
 * official vintages' own errors, and the generation-queue backtest.
 */
export default function BacktestPage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: "Backtest" }]} />
      <BacktestScreen />
    </>
  );
}
