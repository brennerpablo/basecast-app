import { Database } from "lucide-react";

import { PagePlaceholder } from "../_components/page-placeholder";

export default function DataPage() {
  return (
    <PagePlaceholder
      breadcrumb={[{ label: "Data" }]}
      Icon={Database}
      title="Data sources"
      description="Sources, last update and the pipeline run history (etl_run)."
    />
  );
}
