import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { BreadcrumbBar } from "@/components/page-breadcrumb";
import { GlobalLinkMenu } from "@/components/tabs/global-link-menu";
import { TabScreen } from "@/components/tabs/tab-screen";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { getAccessMode } from "@/lib/access-mode";
import { getCachedSession } from "@/lib/auth/session";

import { AppCardWrapper } from "./_components/app-card-wrapper";
import { AppSidebar } from "./_components/app-sidebar";
import { TabStrip } from "./_components/tabs/tab-strip";
import { UserMenu } from "./_components/user-menu";

/** Whose tab list this is. There is no login (ACCESS_MODE=public), so one
 *  list per browser; with login it becomes the user id. */
const TABS_OWNER = "public";

/**
 * The app shell: sidebar, then the page card. On desktop the card's first row
 * is the sidebar trigger and the tab strip, and the breadcrumb moves below as
 * the page title; on mobile there is no strip and the row is trigger +
 * breadcrumb. In ACCESS_MODE=login it also checks the session (`proxy.ts`
 * already redirected visitors without one) and shows the user menu; in public
 * mode it reads no session.
 */
const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const session = await getCachedSession();
  if (getAccessMode() === "login" && !session) redirect("/sign-in");

  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      {/* The right-click menu of every link in the shell. */}
      <GlobalLinkMenu />
      <AppSidebar
        footer={
          session ? (
            <UserMenu
              name={session.user.name}
              username={session.user.username}
              email={session.user.email}
            />
          ) : null
        }
      />
      <main className="flex-1 overflow-auto p-4 max-md:bg-card">
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
            <TabScreen>{children}</TabScreen>
          </AppCardWrapper>
        </BreadcrumbProvider>
      </main>
    </SidebarProvider>
  );
};

export default AppLayout;
