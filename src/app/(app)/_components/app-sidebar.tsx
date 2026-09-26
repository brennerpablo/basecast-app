import { cookies } from "next/headers";
import type { ReactNode } from "react";

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

export async function AppSidebar({ footer }: { footer?: ReactNode }) {
  const cookieStore = await cookies();
  const initialExpanded = parseCookieJson(cookieStore.get(SIDEBAR_EXPANDED_COOKIE)?.value);

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarNav initialExpanded={initialExpanded} footer={footer} />
      </SidebarContent>
    </Sidebar>
  );
}
