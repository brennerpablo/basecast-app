"use client";

import "./globals.css";

import Link from "next/link";
import { useEffect } from "react";

import Logo from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-canvas font-sans">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="flex w-full max-w-md flex-col items-center text-center">
            <div className="mb-8 text-foreground">
              <Logo size={36} />
            </div>
            <h1 className="mb-2 text-2xl font-semibold text-slate-900">
              Something went wrong
            </h1>
            <p className="mb-8 text-sm text-slate-600">
              An unexpected error happened. Please try again or go back to the
              start.
            </p>
            {process.env.NODE_ENV === "development" && (
              <pre className="mb-6 max-h-40 w-full overflow-auto whitespace-pre-wrap wrap-break-word rounded bg-slate-100 p-3 text-left text-xs text-slate-700">
                {error.message}
                {error.digest && `\n\ndigest: ${error.digest}`}
              </pre>
            )}
            <div className="flex gap-3">
              <Button onClick={() => window.location.reload()}>Try again</Button>
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Back to start
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
