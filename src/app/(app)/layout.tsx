import { cookies } from "next/headers";

import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DemoMenu } from "@/components/demo/demo-menu";
import { SnapshotClock } from "@/components/demo/snapshot-clock";
import { BreadcrumbBar } from "@/components/page-breadcrumb";
import { formatDate } from "@/components/product/format";
import { GlobalLinkMenu } from "@/components/tabs/global-link-menu";
import { TabScreen } from "@/components/tabs/tab-screen";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DEMO_BANNER_COOKIE } from "@/lib/demo";
import { recordedAt } from "@/lib/snapshot/serve";

import { AppCardWrapper } from "./_components/app-card-wrapper";
import { AppSidebar } from "./_components/app-sidebar";
import { TabStrip } from "./_components/tabs/tab-strip";

/** The tab list's owner: the demo has no users, so one list per browser. */
const TABS_OWNER = "demo";

/**
 * The app shell: sidebar, then the page card. On desktop the card's first row
 * is the sidebar trigger and the tab strip, and the breadcrumb moves below as
 * the page title; on mobile there is no strip and the row is trigger +
 * breadcrumb. Above the card, the demo banner until it is closed; the
 * sidebar's footer is the demo card.
 */
const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const showBanner = !cookieStore.get(DEMO_BANNER_COOKIE);
  const recorded = recordedAt();
  const recordedOn = formatDate(recorded);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {/* The right-click menu of every link in the shell. */}
      <GlobalLinkMenu />
      <AppSidebar footer={<DemoMenu recordedOn={recordedOn} />} />
      <main className="flex-1 overflow-auto p-4 max-md:bg-card">
        {showBanner ? <DemoBanner recordedOn={recordedOn} /> : null}
        <BreadcrumbProvider>
          <AppCardWrapper>
            {/* On desktop the bar runs edge to edge across the top of the
                card, and the tabs stretch down to its rule. */}
            <div className="flex items-center gap-2 md:-mx-6 md:-mt-6 md:h-14 md:items-stretch md:border-b md:px-4 md:pt-2">
              <div className="flex shrink-0 items-center gap-2">
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-4 max-md:hidden" />
              </div>
              <div className="flex min-w-0 items-center gap-2 md:hidden">
                <BreadcrumbBar />
              </div>
              <TabStrip owner={TABS_OWNER} className="max-md:hidden" />
            </div>
            <Separator className="my-4 md:hidden" />
            <div className="pt-5 max-md:hidden">
              <BreadcrumbBar variant="title" />
            </div>
            <TabScreen>
              <SnapshotClock recordedAt={recorded}>{children}</SnapshotClock>
            </TabScreen>
          </AppCardWrapper>
        </BreadcrumbProvider>
      </main>
    </SidebarProvider>
  );
};

export default AppLayout;
