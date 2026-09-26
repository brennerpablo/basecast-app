"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { ThemeMenu } from "@/components/theme/theme-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import { clearTabs } from "@/lib/tabs/tabs-store";

interface Props {
  name?: string | null;
  username: string;
  email?: string | null;
}

/** The signed-in user, the theme and sign out, in the sidebar footer, as in the Fundsys app. */
export function UserMenu({ name, username, email }: Props) {
  const displayName = name || username;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar"
        >
          <UserAvatar name={displayName} />
          <span className="min-w-0 flex-1 truncate">{displayName}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{displayName}</p>
          <p className="truncate text-xs text-muted-foreground">{email ?? username}</p>
        </div>
        <DropdownMenuSeparator />
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
