import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { ACCOUNT_ROUTE } from "@/lib/navigation";

import { AccountView } from "./_components/account-view";

/** The signed-in user's own account: display name and photo, as in the Fundsys app. */
export default function AccountPage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: ACCOUNT_ROUTE.label }]} />
      <AccountView />
    </>
  );
}
