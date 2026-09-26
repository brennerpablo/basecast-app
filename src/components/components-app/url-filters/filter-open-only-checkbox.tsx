"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface FilterOpenOnlyCheckboxProps {
  id: string;
  checked: boolean;
  onCheckedChange: (openOnly: boolean) => void;
  label?: string;
}

/** Checkbox “Abertas” com estilo emerald (pipeline ações / CRM). */
export function FilterOpenOnlyCheckbox({
  id,
  checked,
  onCheckedChange,
  label = "Abertas"}: FilterOpenOnlyCheckboxProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 sm:py-1",
        checked
          ? "border-basecast-brand-border bg-basecast-brand-surface"
          : "border-dashed border-border"
      )}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
      />
      <Label
        htmlFor={id}
        className="cursor-pointer text-sm font-medium text-muted-foreground sm:text-xs"
      >
        {label}
      </Label>
    </div>
  );
}
