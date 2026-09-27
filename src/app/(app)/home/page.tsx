import { PageBreadcrumb } from "@/components/page-breadcrumb";

import { HomeScreen } from "./_components/home-screen";

/** Home: one highlight per module, each linking to the screen behind it. */
export default function HomePage() {
  return (
    <>
      <PageBreadcrumb items={[{ label: "Home" }]} />
      <HomeScreen />
    </>
  );
}
