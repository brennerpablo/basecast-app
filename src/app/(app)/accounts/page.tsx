import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { AccountsScreen } from "./_components/accounts-screen";

/** Commercial intelligence: the co-ops and munis ranked by priority, with their triggers and the next action. */
export default function AccountsPage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: "Accounts" }]} />
      <AccountsScreen />
    </>
  );
}
