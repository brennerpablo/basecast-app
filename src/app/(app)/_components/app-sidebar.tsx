import { cookies } from "next/headers";

import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { SIDEBAR_EXPANDED_COOKIE } from "@/lib/navigation";

import { SidebarNav } from "./sidebar-nav";

function parseCookieJson(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(value));
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function AppSidebar() {
  const cookieStore = await cookies();
  const initialExpanded = parseCookieJson(cookieStore.get(SIDEBAR_EXPANDED_COOKIE)?.value);

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarNav initialExpanded={initialExpanded} />
      </SidebarContent>
    </Sidebar>
  );
}
