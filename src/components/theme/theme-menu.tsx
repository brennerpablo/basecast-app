"use client";

import { Moon, Sun } from "lucide-react";

import {
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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

/** Theme picker, a submenu of the user menu. */
export function ThemeMenu() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <ThemeIcon />
        Theme
      </DropdownMenuSubTrigger>
      <DropdownMenuPortal>
        <DropdownMenuSubContent>
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
        </DropdownMenuSubContent>
      </DropdownMenuPortal>
    </DropdownMenuSub>
  );
}
