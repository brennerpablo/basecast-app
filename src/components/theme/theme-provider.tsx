"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

import { useThemeSnapshot } from "@/lib/hooks/use-theme";
import { applyTheme } from "@/lib/theme/theme-store";

/**
 * Not a context provider: the state lives in a module store
 * (`lib/theme/theme-store.ts`) and any component reaches it through
 * `useTheme()`. This component exists for one reason: to RE-APPLY the class on
 * `<html>` when something wipes it (the StrictMode remount in dev, or the
 * router during navigation; hence `pathname` in the dependencies).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme, resolvedTheme } = useThemeSnapshot();
  const pathname = usePathname();

  useLayoutEffect(() => {
    applyTheme();
  }, [theme, resolvedTheme, pathname]);

  return <>{children}</>;
}
