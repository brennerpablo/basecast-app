"use client";

import {
  ChevronDown,
  Plus
} from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface FilterChipMultiselectProps {
  /** Unique prefix for the checkbox and label ids (e.g. `accounts`). */
  idPrefix: string;
  field: string;
  label: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onApply: (values: string[]) => void;
  onReset: () => void;
}

/**
 * A multiselect filter chip (popover + Apply), the Fundsys Actions/CRM pattern.
 */
export function FilterChipMultiselect({
  idPrefix,
  field,
  label,
  options,
  selectedValues,
  onApply,
  onReset}: FilterChipMultiselectProps) {
  const [tempValues, setTempValues] = useState(selectedValues);

  const selectionKey = selectedValues.join("\0");
  useEffect(() => {
    setTempValues([...selectedValues]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionKey]);

  const handleApply = () => {
    onApply(tempValues);
  };

  const handleReset = () => {
    setTempValues([]);
    onReset();
  };

  const labelForValue = (v: string) =>
    options.find((o) => o.value === v)?.label ?? v;

  const displayLabelFor = (values: string[]) => {
    if (values.length === 0) return label;
    if (values.length === 1) return labelForValue(values[0]);
    return `${labelForValue(values[0])} +${values.length - 1}`;
  };

  const appliedCount = selectedValues.length;

  if (options.length === 0) return null;

  const checkboxId = (value: string) =>
    `${idPrefix}-filter-${field}-${value}`;

  return (
    <Popover
      onOpenChange={(open) => {
        if (open) setTempValues([...selectedValues]);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-x-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted sm:text-xs",
            appliedCount > 0
              ? "border-basecast-brand-border bg-basecast-brand-surface"
              : "border-dashed border-border"
          )}
        >
          <span
            aria-hidden="true"
            onClick={(e) => {
              if (appliedCount > 0) {
                e.stopPropagation();
                onReset();
              }
            }}
          >
            <Plus
              className={cn(
                "-ml-px size-5 shrink-0 transition sm:size-4",
                appliedCount > 0 && "rotate-45 hover:text-destructive"
              )}
            />
          </span>
          <span>{label}</span>
          {appliedCount > 0 && <span className="h-4 w-px bg-border" />}
          {appliedCount > 0 && (
            <span className="font-semibold text-basecast-brand">
              {displayLabelFor(selectedValues)}
            </span>
          )}
          <ChevronDown className="size-5 shrink-0 text-muted-foreground sm:size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={7}
        className="sm:min-w-56 sm:max-w-56"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApply();
          }}
        >
          <div className="space-y-2">
            <div>
              <Label className="text-base font-medium sm:text-sm">
                Filter by {label.toLowerCase()}
              </Label>
              <div className="mt-2 space-y-2 overflow-y-auto sm:max-h-36">
                {options.map((option) => (
                  <div key={option.value} className="flex items-center gap-2">
                    <Checkbox
                      id={checkboxId(option.value)}
                      checked={tempValues.includes(option.value)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setTempValues([...tempValues, option.value]);
                        } else {
                          setTempValues(
                            tempValues.filter((v) => v !== option.value)
                          );
                        }
                      }}
                    />
                    <Label
                      htmlFor={checkboxId(option.value)}
                      className="text-base sm:text-sm cursor-pointer"
                    >
                      {option.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
            <PopoverClose className="w-full" asChild>
              <Button type="submit" variant="brand" className="w-full" size="sm">
                Apply
              </Button>
            </PopoverClose>
            {tempValues.length > 0 && (
              <Button
                variant="secondary"
                className="w-full"
                size="sm"
                type="button"
                onClick={handleReset}
              >
                Clear
              </Button>
            )}
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
