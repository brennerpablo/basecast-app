import Link from "next/link";
import type { ReactNode } from "react";

import Logo from "@/components/brand/logo";
import { ThemeMenu } from "@/components/theme/theme-menu";

/**
 * The sidebar shell: logo, optional toolbar, scrollable content area and the
 * footer with the theme picker. Kept as its own component so every sidebar
 * variant keeps the chrome in the same place.
 */
export function SidebarChrome({
  toolbar,
  children,
}: {
  toolbar?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="mb-2 flex h-20 shrink-0 flex-col justify-center px-6">
        <Link href="/" className="w-fit rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
          <Logo />
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        {toolbar ? (
          <div className="w-full shrink-0 px-2 pb-1">{toolbar}</div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        <div className="w-full shrink-0 border-t border-sidebar-border p-2">
          <ThemeMenu />
        </div>
      </div>
    </div>
  );
}
