"use client";

import { ChevronsDown, ChevronsUp } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useDataTableLocale } from "../DataTableLocaleContext";

type MultilevelExpansionControlsProps = {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  iconsOnly?: boolean;
  disabled?: boolean;
};

export function MultilevelExpansionControls({
  onExpandAll,
  onCollapseAll,
  iconsOnly = false,
  disabled = false,
}: MultilevelExpansionControlsProps) {
  const locale = useDataTableLocale();

  return (
    <div className="hidden items-center gap-1 lg:flex">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-x-2 px-2 py-1.5 text-sm sm:text-xs"
        onClick={onExpandAll}
        disabled={disabled}
        aria-label={locale.expandAll}
        title={locale.expandAll}
      >
        <ChevronsDown className="size-4 shrink-0" aria-hidden="true" />
        {!iconsOnly && locale.expandAll}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-x-2 px-2 py-1.5 text-sm sm:text-xs"
        onClick={onCollapseAll}
        disabled={disabled}
        aria-label={locale.collapseAll}
        title={locale.collapseAll}
      >
        <ChevronsUp className="size-4 shrink-0" aria-hidden="true" />
        {!iconsOnly && locale.collapseAll}
      </Button>
    </div>
  );
}
