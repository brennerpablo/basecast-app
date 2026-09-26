"use client";

import { Moon, Sun } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/lib/hooks/use-theme";
import { type Theme, THEMES } from "@/lib/theme/theme-cookie";

/**
 * One menu, with the dark styles side by side with light: the choice is
 * "which look", not "light or dark, then which palette".
 *
 * There is no "System" option on purpose; see `theme-cookie.ts`.
 */
const THEME_LABEL: Record<Theme, string> = {
  light: "Light",
  zinc: "Dark · Zinc",
  deep: "Dark · Deep",
};

/** Theme picker for the sidebar footer. */
export function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <ThemeIcon className="size-4 shrink-0 text-muted-foreground" />
          <span>Theme</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {THEME_LABEL[theme]}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel>Theme</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => setTheme(value as Theme)}
        >
          {THEMES.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {THEME_LABEL[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
