import { Map } from "lucide-react";

import { PagePlaceholder } from "../_components/page-placeholder";

export default function ExplorerPage() {
  return (
    <PagePlaceholder
      breadcrumb={[{ label: "Explorer" }]}
      Icon={Map}
      title="Texas county map"
      description="Raw vs. adjusted interconnection queue by county, and priority acquisition zones."
    />
  );
}
