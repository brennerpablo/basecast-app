import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { ExplorerScreen } from "./_components/explorer-screen";

/** Explorer: the Texas counties by acquisition priority, generation queue and new data centers. */
export default function ExplorerPage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: "Explorer" }]} />
      <ExplorerScreen />
    </>
  );
}
