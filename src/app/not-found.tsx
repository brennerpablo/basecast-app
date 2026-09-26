import { FileQuestion, Home } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <section className="w-full max-w-xl rounded-lg border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-basecast-brand-border bg-basecast-brand-surface">
          <FileQuestion className="size-7 text-basecast-brand" aria-hidden="true" />
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-sm font-medium text-basecast-brand">404</p>
          <h1 className="text-2xl font-semibold text-foreground">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            The page you tried to open does not exist or was moved.
          </p>
        </div>

        <div className="mt-6">
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Home className="size-4" />
            Go to start
          </Link>
        </div>
      </section>
    </main>
  );
}
