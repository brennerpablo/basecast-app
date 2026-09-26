"use client";

import { Layers } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import { useDataTableLocale } from "../DataTableLocaleContext";
import type { MultilevelHierarchyLevelDef } from "../types";

const STORAGE_PREFIX = "data-table-hierarchy-levels:";

function readStoredLevels(storageKey: string): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string" && id.length > 0);
  } catch {
    return null;
  }
}

function writeStoredLevels(storageKey: string, levelIds: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(levelIds));
  } catch {
    /* ignore quota */
  }
}

export function useMultilevelVisibleLevels({
  levels,
  storageKey,
  visibleLevelIds: controlled,
  onVisibleLevelIdsChange,
}: {
  levels: readonly MultilevelHierarchyLevelDef[];
  storageKey?: string;
  visibleLevelIds?: string[];
  onVisibleLevelIdsChange?: (ids: string[]) => void;
}) {
  const allIds = React.useMemo(() => levels.map((level) => level.id), [levels]);

  const defaultIds = React.useMemo(() => {
    const fromDef = levels
      .filter((level) => level.defaultVisible !== false)
      .map((level) => level.id);
    return fromDef.length > 0 ? fromDef : allIds;
  }, [allIds, levels]);

  const [internal, setInternal] = React.useState<string[]>(() => {
    if (controlled) return controlled;
    if (storageKey) {
      const stored = readStoredLevels(storageKey);
      if (stored?.length) {
        const valid = stored.filter((id) => allIds.includes(id));
        if (valid.length > 0) return valid;
      }
    }
    return defaultIds;
  });

  const visibleLevelIds = controlled ?? internal;

  const setVisibleLevelIds = React.useCallback(
    (next: string[]) => {
      const sanitized = next.filter((id) => allIds.includes(id));
      if (sanitized.length === 0) return;
      onVisibleLevelIdsChange?.(sanitized);
      if (!controlled) {
        setInternal(sanitized);
        if (storageKey) writeStoredLevels(storageKey, sanitized);
      }
    },
    [allIds, controlled, onVisibleLevelIdsChange, storageKey],
  );

  const visibleSet = React.useMemo(() => new Set(visibleLevelIds), [visibleLevelIds]);

  return { visibleLevelIds, visibleSet, setVisibleLevelIds, allIds };
}

type MultilevelHierarchyLevelOptionsProps = {
  levels: readonly MultilevelHierarchyLevelDef[];
  visibleLevelIds: string[];
  onVisibleLevelIdsChange: (ids: string[]) => void;
  iconsOnly?: boolean;
};

export function MultilevelHierarchyLevelOptions({
  levels,
  visibleLevelIds,
  onVisibleLevelIdsChange,
  iconsOnly = false,
}: MultilevelHierarchyLevelOptionsProps) {
  const locale = useDataTableLocale();
  const visibleSet = React.useMemo(() => new Set(visibleLevelIds), [visibleLevelIds]);

  const toggleLevel = (levelId: string, checked: boolean) => {
    if (checked) {
      if (!visibleSet.has(levelId)) {
        onVisibleLevelIdsChange([...visibleLevelIds, levelId]);
      }
      return;
    }
    if (visibleLevelIds.length <= 1) return;
    onVisibleLevelIdsChange(visibleLevelIds.filter((id) => id !== levelId));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
          aria-label={locale.hierarchyLevels}
        >
          <Layers className="size-4 shrink-0" aria-hidden="true" />
          {!iconsOnly && locale.hierarchyLevels}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={7} className="z-50 w-fit space-y-2">
        <Label className="font-medium">{locale.hierarchyLevelsTitle}</Label>
        <p className="text-xs text-muted-foreground">{locale.hierarchyLevelsHint}</p>
        <div className="flex flex-col gap-2">
          {levels.map((level) => {
            const checked = visibleSet.has(level.id);
            const disabled = checked && visibleLevelIds.length <= 1;
            return (
              <div key={level.id} className="flex items-center gap-2">
                <Checkbox
                  id={`hierarchy-level-${level.id}`}
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={(value) => toggleLevel(level.id, value === true)}
                />
                <Label
                  htmlFor={`hierarchy-level-${level.id}`}
                  className="cursor-pointer text-sm font-normal"
                >
                  {level.label}
                </Label>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
