"use client";

import type { Fact } from "@/lib/bff/envelope";
import { cn } from "@/lib/utils";

import { FactValue } from "./fact-value";

/** One Fact as a field: its label in small caps over the value (the Fundsys detail field). */
export function FactField({ fact, className }: { fact: Fact; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{fact.label}</p>
      <FactValue fact={fact} className="mt-0.5" valueClassName="text-sm font-medium text-foreground wrap-break-word" />
    </div>
  );
}

/** Facts as a responsive grid of fields, in the order the API sends them. */
export function FactGrid({ facts, className }: { facts: Fact[]; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-4", className)}>
      {facts.map((fact) => (
        <FactField key={fact.key} fact={fact} />
      ))}
    </div>
  );
}
