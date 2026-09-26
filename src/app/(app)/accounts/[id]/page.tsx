import { AccountScreen } from "./_components/account-screen";

/** One account's diagnosis: who they are, the next action, why now, the score, the territory and the EIA series. */
export default async function AccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountScreen id={id} />;
}
