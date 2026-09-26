"use client";

import Link from "next/link";
import { useEffect } from "react";

import Logo from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AppError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("App route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <div className="mb-8">
          <Logo size={36} />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Something went wrong
        </h1>
        <p className="mb-8 text-sm text-slate-600 dark:text-slate-400">
          We hit an unexpected error while loading this page. You can try again
          or go back to the start.
        </p>
        {process.env.NODE_ENV === "development" && (
          <pre className="mb-6 max-h-40 w-full overflow-auto whitespace-pre-wrap wrap-break-word rounded bg-slate-100 p-3 text-left text-xs text-slate-700 dark:bg-muted dark:text-slate-300">
            {error.message}
            {error.digest && `\n\ndigest: ${error.digest}`}
          </pre>
        )}
        <div className="flex gap-3">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to start</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
