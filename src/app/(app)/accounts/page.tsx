import { Building2 } from "lucide-react";

import { PagePlaceholder } from "../_components/page-placeholder";

export default function AccountsPage() {
  return (
    <PagePlaceholder
      breadcrumb={[{ label: "Accounts" }]}
      Icon={Building2}
      title="Commercial intelligence"
      description="Co-ops and munis ranked by priority, with their triggers and the next action."
    />
  );
}
