"use client";

import { Camera, ExternalLink } from "lucide-react";

import { ThemeMenu } from "@/components/theme/theme-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HACKATHON } from "@/lib/demo";

/** The sidebar footer: this copy is a static demo recorded on one day, then how it was built and the theme. */
export function DemoMenu({ recordedOn }: { recordedOn: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus:ring-2 focus:ring-sidebar-ring focus:ring-offset-2 focus:ring-offset-sidebar"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <Camera className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">Static demo</span>
            <span className="block truncate text-xs text-muted-foreground">Recorded {recordedOn}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-64">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">{HACKATHON.name}</p>
          <p className="text-xs text-muted-foreground">
            {HACKATHON.place} · {HACKATHON.dates}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <a href="/how-its-built">
            <ExternalLink />
            How it&apos;s built
          </a>
        </DropdownMenuItem>
        <ThemeMenu />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
