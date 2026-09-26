"use client";

import { LogOut, UserRound } from "lucide-react";
import { signOut } from "next-auth/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  name?: string | null;
  username: string;
  email?: string | null;
}

/** The signed-in user and sign out, in the sidebar footer. Only rendered in ACCESS_MODE=login. */
export function UserMenu({ name, username, email }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar"
        >
          <UserRound className="size-4 shrink-0 text-sidebar-foreground/70" />
          <span className="truncate">{name || username}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel className="font-normal">
          <div className="truncate font-medium">{name || username}</div>
          <div className="truncate text-xs text-muted-foreground">{email ?? username}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => signOut({ callbackUrl: "/sign-in" })}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
