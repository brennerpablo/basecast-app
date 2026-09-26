"use client";

import {
  ChevronsUpDown,
  X
} from "lucide-react";
import * as React from "react";

import { type RenderItemFn } from "@/components/components-app/ui/select";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger} from "@/components/ui/popover";
import {
  paletteCheckbox,
  paletteChip,
  type PaletteColor} from "@/lib/palette";
import { cn } from "@/lib/utils";

export type MultiSelectColor = PaletteColor;
export type { RenderItemFn };

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface MultiSelectContextValue {
  selected: string[];
  onSelect: (value: string) => void;
  color: MultiSelectColor;
  renderItem?: RenderItemFn;
}

const MultiSelectContext = React.createContext<MultiSelectContextValue>({
  selected: [],
  onSelect: () => {},
  color: "slate"});

// ---------------------------------------------------------------------------
// MultiSelectItem
// ---------------------------------------------------------------------------

interface MultiSelectItemProps {
  value: string;
  className?: string;
  /** Texto usado na busca quando `children` não é string. */
  searchLabel?: string;
  children: React.ReactNode;
}

function MultiSelectItem({ value, className, searchLabel, children }: MultiSelectItemProps) {
  const { selected, onSelect, color, renderItem } = React.useContext(MultiSelectContext);
  const isSelected = selected.includes(value);
  const checkboxCls = paletteCheckbox[color];

  const label =
    searchLabel ??
    (typeof children === "string" ? children : String(value));
  const customContent = renderItem?.({ value, label });

  return (
    <CommandItem
      value={label}
      onSelect={() => onSelect(value)}
      className={cn("flex items-start gap-2 cursor-pointer", className)}
    >
      <div
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
          isSelected ? checkboxCls : "border-slate-300 dark:border-slate-600 bg-white dark:bg-card",
        )}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          style={{ opacity: isSelected ? 1 : 0, stroke: "rgba(255,255,255,0.85)" }}
        >
          <path
            d="M11.2 5.6L6.8 10L4.8 8"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </div>
      <span className="min-w-0 flex-1 break-words">{customContent ?? children}</span>
    </CommandItem>
  );
}

// ---------------------------------------------------------------------------
// MultiSelect
// ---------------------------------------------------------------------------

interface MultiSelectProps {
  color?: MultiSelectColor;
  disabled?: boolean;
  /** Quando o form (RHF) faz reset, repasse os ids selecionados para espelhar no estado interno. */
  defaultSelected?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  placeholderSearch?: string;
  renderItem?: RenderItemFn;
  className?: string;
  children: React.ReactNode;
}

function MultiSelect({
  color = "slate",
  disabled,
  defaultSelected,
  onValueChange,
  placeholder = "Select...",
  placeholderSearch = "Search...",
  renderItem,
  className,
  children}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>(() => [...(defaultSelected ?? [])]);
  const checkboxCls = paletteCheckbox[color];
  const chipCls = paletteChip[color];

  const defaultSelectedSig = JSON.stringify([...(defaultSelected ?? [])].sort());

  React.useEffect(() => {
    if (defaultSelected === undefined) return;
    const next = [...defaultSelected];
    setSelected((prev) => {
      const a = [...prev].sort().join("\0");
      const b = [...next].sort().join("\0");
      return a === b ? prev : next;
    });
  }, [defaultSelectedSig, defaultSelected]);

  // Build a label map from children so we can render chips for selected items
  const labelMap = React.useMemo(() => {
    const map: Record<string, React.ReactNode> = {};
    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement<MultiSelectItemProps>(child) &&
        child.props.value != null
      ) {
        map[child.props.value] = child.props.children;
      }
    });
    return map;
  }, [children]);

  const handleSelect = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    setSelected(next);
    onValueChange?.(next);
  };

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = selected.filter((v) => v !== value);
    setSelected(next);
    onValueChange?.(next);
  };

  return (
    <MultiSelectContext.Provider value={{ selected, onSelect: handleSelect, color, renderItem }}>
      <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className={cn(
              "group w-full min-w-0 max-w-full justify-between h-auto min-h-9 font-normal px-3 py-1.5",
              className,
            )}
          >
            {selected.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : (
              // [contain:inline-size] zera a largura intrínseca: sem isso, um chip longo
              // (whitespace-nowrap herdado do Button) infla a trilha do grid do Dialog e,
              // por consequência, a largura do trigger e do popover.
              <div className="flex min-w-0 flex-1 flex-wrap gap-1 [contain:inline-size]">
                {selected.map((val) => (
                  <span
                    key={val}
                    onClick={(e) => handleRemove(val, e)}
                    className={cn(
                      "inline-flex min-w-0 max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium cursor-pointer transition-colors group-hover:bg-white dark:group-hover:bg-card",
                      chipCls,
                    )}
                  >
                    <span className="min-w-0 truncate">{labelMap[val]}</span>
                    <X className="size-3 opacity-60 pointer-events-none" />
                  </span>
                ))}
              </div>
            )}
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {selected.length > 0 && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected([]);
                    onValueChange?.([]);
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-md p-0.5 cursor-pointer transition-colors group-hover:bg-white dark:group-hover:bg-card",
                    chipCls,
                  )}
                >
                  <X className="size-3 opacity-60 pointer-events-none" />
                </span>
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) max-w-(--radix-popover-content-available-width) min-w-0 p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={placeholderSearch} />
            <CommandList onWheel={(e) => e.stopPropagation()}>
              <CommandEmpty>No results.</CommandEmpty>
              <CommandGroup>{children}</CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </MultiSelectContext.Provider>
  );
}

export { MultiSelect, MultiSelectItem };
export type { MultiSelectItemProps, MultiSelectProps };
