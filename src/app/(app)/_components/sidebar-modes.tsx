"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DataSidebar } from "@/components/data-browser/data-sidebar";

import { SidebarNav } from "./sidebar-nav";

/**
 * Swaps the sidebar's content by route, as the Fundsys app does for its modes: under /data the main menu
 * gives way to the Data mode's own sidebar; everywhere else it is the main menu.
 */
export function SidebarModes({
  initialExpanded,
  footer,
}: {
  initialExpanded?: string[];
  footer?: ReactNode;
}) {
  const pathname = usePathname();
  if (pathname === "/data" || pathname.startsWith("/data/")) return <DataSidebar footer={footer} />;
  return <SidebarNav initialExpanded={initialExpanded} footer={footer} />;
}
