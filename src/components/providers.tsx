"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState } from "react";
import { Toaster } from "sonner";

import { ThemeProvider } from "@/components/theme/theme-provider";
import { useTheme } from "@/lib/hooks/use-theme";
import { DEFAULT_QUERY_STALE_MS } from "@/lib/query-config";

interface ProvidersProps {
  children: React.ReactNode;
}

/** HTTP status of a failed request, when the error carries one. */
function statusOf(error: unknown): number | undefined {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : undefined;
}

/**
 * Sonner has its own theme and defaults to light, so without this a toast
 * shows up white on a dark page.
 */
function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors theme={resolvedTheme} />;
}

const Providers = ({ children }: ProvidersProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: DEFAULT_QUERY_STALE_MS,
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
            // Don't burn seconds of exponential backoff retrying a
            // deterministic 4xx before surfacing the error to the UI; only
            // retry genuine server/network failures.
            retry: (count, err) => {
              const status = statusOf(err);
              return (status === undefined || status >= 500) && count < 2;
            },
          },
        },
      }),
  );

  return (
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ReactQueryDevtools initialIsOpen={false} />
          <ThemedToaster />
          {children}
        </ThemeProvider>
      </QueryClientProvider>
    </NuqsAdapter>
  );
};

export default Providers;
