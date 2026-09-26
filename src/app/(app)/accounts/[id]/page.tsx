import { Building2 } from "lucide-react";

import { PagePlaceholder } from "../../_components/page-placeholder";

export default async function AccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <PagePlaceholder
      breadcrumb={[{ label: "Accounts", href: "/accounts" }, { label: id }]}
      Icon={Building2}
      title="Account diagnosis"
      description="Triggers, capacity deficit by year and the next action with its evidence."
    />
  );
}
