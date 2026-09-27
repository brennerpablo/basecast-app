"use client";

import { LogOut } from "lucide-react";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";

import { ThemeMenu } from "@/components/theme/theme-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/user-avatar";
import { ACCOUNT_ROUTE, ADMIN_USERS_ROUTE } from "@/lib/navigation";
import { clearTabs } from "@/lib/tabs/tabs-store";

/**
 * Fundsys's orange for an item only a superadmin sees: the whole item is the mark. The shadcn item sets
 * `focus:bg-accent`, `data-[highlighted]:bg-accent` and a muted icon, so each state is overridden.
 */
const superAdminItemClass =
  "bg-orange-100 text-orange-900 focus:bg-orange-200 focus:text-orange-900 data-[highlighted]:bg-orange-200 data-[highlighted]:text-orange-900 [&_svg]:text-orange-700 data-[highlighted]:[&_svg]:text-orange-700 dark:bg-orange-950/45 dark:text-orange-200 dark:focus:bg-orange-950/70 dark:focus:text-orange-200 dark:data-[highlighted]:bg-orange-950/70 dark:data-[highlighted]:text-orange-200 dark:[&_svg]:text-orange-300 dark:data-[highlighted]:[&_svg]:text-orange-300";

/**
 * The signed-in user, the admin screens (superadmins only), their account,
 * the theme and sign out, in the sidebar footer, as in the Fundsys app. Reads the live session, so an edit on
 * /account shows here at once.
 */
export function UserMenu() {
  const { data: session } = useSession();
  const { isMobile, setOpenMobile } = useSidebar();
  if (!session) return null;

  const { name, username, email, image, isSuperAdmin } = session.user;
  const displayName = name || username;
  const closeDrawer = () => isMobile && setOpenMobile(false);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar"
        >
          <UserAvatar name={displayName} image={image} />
          <span className="min-w-0 flex-1 truncate">{displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{email ?? username}</p>
        </div>
        <DropdownMenuSeparator />
        {/* On mobile the sidebar is a drawer over the page: close it, as the
            menu links do. */}
        {isSuperAdmin && (
          <>
            <DropdownMenuItem
              asChild
              className={`cursor-pointer ${superAdminItemClass}`}
              title="Superadmins only"
            >
              <Link href={ADMIN_USERS_ROUTE.href} onClick={closeDrawer}>
                <ADMIN_USERS_ROUTE.icon />
                {ADMIN_USERS_ROUTE.label}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={ACCOUNT_ROUTE.href} onClick={closeDrawer}>
            <ACCOUNT_ROUTE.icon />
            {ACCOUNT_ROUTE.label}
          </Link>
        </DropdownMenuItem>
        <ThemeMenu />
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-destructive focus:text-destructive"
          onSelect={() => {
            // The tab list leaves sessionStorage, so whoever signs in next in
            // this browser starts with one tab; pinned tabs stay under this
            // user's key and come back with them.
            clearTabs();
            void signOut({ callbackUrl: "/sign-in" });
          }}
        >
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
