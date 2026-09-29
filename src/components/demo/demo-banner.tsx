"use client";

import { ArrowRight, X } from "lucide-react";
import { useState } from "react";

import { DEMO_BANNER_COOKIE, HACKATHON } from "@/lib/demo";

/**
 * Above every screen: this is a static copy of BaseCast, built for the hackathon, on data recorded on one
 * day. Closing it sets a cookie for a year; the sidebar's demo card keeps the same facts.
 */
export function DemoBanner({ recordedOn }: { recordedOn: string }) {
  const [open, setOpen] = useState(true);
  if (!open) return null;

  const close = () => {
    document.cookie = `${DEMO_BANNER_COOKIE}=closed; path=/; max-age=31536000; samesite=lax`;
    setOpen(false);
  };

  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-3 rounded-lg border border-basecast-brand-border bg-basecast-brand-surface px-4 py-2.5 text-sm"
    >
      <span className="mt-px shrink-0 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">
        Static demo
      </span>
      <p className="min-w-0 flex-1 text-foreground">
        Built for the {HACKATHON.name} ({HACKATHON.place}, {HACKATHON.dates}). This copy runs on a snapshot of its
        data recorded on {recordedOn}; nothing on it updates.{" "}
        <a href="/how-its-built" className="inline-flex items-center gap-1 font-medium text-basecast-brand hover:underline">
          How it&apos;s built
          <ArrowRight className="size-3.5" aria-hidden />
        </a>
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="Close"
        className="-mr-1 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-background/60 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
