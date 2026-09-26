import "./globals.css";

import type { Metadata, Viewport } from "next";

import Providers from "@/components/providers";
import { ThemeScript } from "@/components/theme/theme-script";

// Repeats `color-scheme: only light` from globals.css as a <meta>, which the
// browser reads BEFORE downloading the stylesheet: it decides the scrollbar and
// UA widget colors on the first paint. Users who picked dark are served by
// `.dark { color-scheme: only dark }` in globals.css.
export const viewport: Viewport = {
  colorScheme: "only light",
};

export const metadata: Metadata = {
  title: "BaseCast",
  description:
    "Forecasts how much of ERCOT's interconnection queues actually gets built, and turns it into peak demand and partnership decisions.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `suppressHydrationWarning` because <ThemeScript> writes `class` and
    // `data-dark-palette` on <html> before hydration, by design.
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
