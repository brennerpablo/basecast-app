import { cookies } from "next/headers";

import { BreadcrumbProvider } from "@/components/breadcrumb-context";
import { BreadcrumbBar } from "@/components/page-breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AppCardWrapper } from "./_components/app-card-wrapper";
import { AppSidebar } from "./_components/app-sidebar";

/**
 * The app shell: sidebar, then the page card with a top bar (sidebar trigger +
 * breadcrumb). There is no login for now (ACCESS_MODE=public), so the shell
 * reads no session.
 */
const AppLayout = async ({ children }: { children: React.ReactNode }) => {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar />
      <main className="flex-1 overflow-auto p-4 max-md:bg-card">
        <BreadcrumbProvider>
          <AppCardWrapper>
            {/* On desktop the bar runs edge to edge across the top of the card. */}
            <div className="flex items-center gap-2 md:-mx-6 md:-mt-6 md:h-14 md:border-b md:px-4">
              <SidebarTrigger />
              <div className="flex min-w-0 items-center gap-2">
                <BreadcrumbBar />
              </div>
            </div>
            <Separator className="my-4 md:hidden" />
            <div className="md:pt-6">{children}</div>
          </AppCardWrapper>
        </BreadcrumbProvider>
      </main>
    </SidebarProvider>
  );
};

export default AppLayout;
