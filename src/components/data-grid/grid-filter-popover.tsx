"use client";

import {
  ArrowDownAZ,
  ArrowUpZA,
  ListFilter,
  Search,
  Snowflake,
} from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  conditionFromDraft,
  conditionOps,
  CONTAINS_MIN_CHARS,
  containsTooShort,
  defaultConditionOp,
  dotGroupsDigits,
} from "./filter-model";
import { foldIncludes } from "./fold-text";
import { useGridContext } from "./grid-context";
import { localeFor } from "./i18n";
import type {
  GridColumn,
  GridColumnFilter,
  GridConditionOp,
} from "./types";

/**
 * Excel-style header menu: sort shortcuts, a condition section typed like
 * the column, and a searchable checkbox list of distinct values. All edits
 * live in local draft state and hit the server once, on "Apply". What a
 * column accepts and what a typed value means live in `filter-model.ts`.
 */

// Render cap for the checkbox list (high-cardinality columns can have
// thousands of values) — searching narrows it; rendering thousands of
// checkboxes would defeat the point.
const LIST_RENDER_CAP = 200;

type Draft = {
  /** null = all values checked (no filter). */
  values: Set<string> | null;
  op: GridConditionOp | "";
  value: string;
  value2: string;
};

function draftFromFilter(
  filter: GridColumnFilter | undefined,
  defaultOp: GridConditionOp | "",
): Draft {
  return {
    values: filter?.values ? new Set(filter.values) : null,
    op: filter?.condition?.op ?? defaultOp,
    value: filter?.condition?.value ?? "",
    value2: filter?.condition?.value2 ?? "",
  };
}

const MENU_ITEM_CLS =
  "flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-accent";

export function GridFilterPopover({
  col,
  index,
}: {
  col: GridColumn<never>;
  /** Visible column index — the freeze boundary is "up to and including me". */
  index: number;
}) {
  const {
    sorting,
    onSortingChange,
    filters,
    onFiltersChange,
    filterOptions,
    frozenCount,
    setFrozen,
    strings,
    language,
  } = useGridContext();
  const dotGroups = React.useMemo(
    () => dotGroupsDigits(localeFor(language)),
    [language],
  );

  const active = filters[col.id];
  const conf = col.filter;
  const options = React.useMemo(
    () => (conf?.optionsKey ? (filterOptions[conf.optionsKey] ?? []) : []),
    [conf, filterOptions],
  );

  const ops = React.useMemo(() => conditionOps(conf), [conf]);
  const isDate = conf?.conditions === "date";
  const defaultOp = defaultConditionOp(conf);

  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [draft, setDraft] = React.useState<Draft>(() =>
    draftFromFilter(active, defaultOp),
  );

  // Re-seed the draft from the applied filter every time the menu opens.
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setDraft(draftFromFilter(active, defaultOp));
      setSearch("");
    }
  };

  const visible = React.useMemo(() => {
    // Folded on both sides: the same value reaches a grid spelled "Ñandú"
    // from one source and "NANDU" from the next, so a raw `includes` finds
    // it on one and not on the other.
    const needle = search.trim();
    const list = needle
      ? options.filter((o) => foldIncludes(o.label, needle))
      : options;
    return list.slice(0, LIST_RENDER_CAP);
  }, [options, search]);

  const allChecked = draft.values === null;
  const checkedCount = draft.values?.size ?? options.length;

  const toggleValue = (value: string) => {
    setDraft((d) => {
      const next = d.values
        ? new Set(d.values)
        : new Set(options.map((o) => o.value));
      if (next.has(value)) next.delete(value);
      else next.add(value);
      // Everything checked again = no filter.
      return {
        ...d,
        values: next.size === options.length ? null : next,
      };
    });
  };

  const toggleAll = () => {
    setDraft((d) => ({
      ...d,
      values: d.values === null ? new Set<string>() : null,
    }));
  };

  const conditionTooShort = containsTooShort(draft.op, draft.value);

  // Zero boxes checked can't be sent to the server ("nothing" isn't a filter
  // the API expresses) — block Apply like Excel greys out OK.
  const nothingChecked =
    options.length > 0 && draft.values !== null && draft.values.size === 0;

  const apply = () => {
    const next: GridColumnFilter = {};
    if (draft.values !== null) next.values = [...draft.values];
    const condition = conditionFromDraft(conf, draft, { dotGroups });
    if (condition) next.condition = condition;
    const nextFilters = { ...filters };
    if (next.values || next.condition) nextFilters[col.id] = next;
    else delete nextFilters[col.id];
    onFiltersChange(nextFilters);
    setOpen(false);
  };

  const clear = () => {
    const nextFilters = { ...filters };
    delete nextFilters[col.id];
    onFiltersChange(nextFilters);
    setOpen(false);
  };

  const inputType =
    conf?.conditions === "number" ? "number" : isDate ? "date" : "text";

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={strings.columnMenu(col.title)}
          className={cn(
            "shrink-0 rounded p-0.5 hover:bg-accent",
            active
              ? "text-basecast-brand opacity-100"
              : "opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100",
          )}
        >
          <ListFilter className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0 text-sm">
        {col.sortable && (
          <div className="p-1">
            <button
              type="button"
              className={MENU_ITEM_CLS}
              onClick={() => {
                onSortingChange({ id: col.id, desc: false });
                setOpen(false);
              }}
            >
              <ArrowDownAZ className="size-4 text-muted-foreground" />
              {strings.sortAsc}
              {sorting?.id === col.id && !sorting.desc && (
                <span className="ml-auto text-basecast-brand">✓</span>
              )}
            </button>
            <button
              type="button"
              className={MENU_ITEM_CLS}
              onClick={() => {
                onSortingChange({ id: col.id, desc: true });
                setOpen(false);
              }}
            >
              <ArrowUpZA className="size-4 text-muted-foreground" />
              {strings.sortDesc}
              {sorting?.id === col.id && sorting.desc && (
                <span className="ml-auto text-basecast-brand">✓</span>
              )}
            </button>
          </div>
        )}

        {ops.length > 0 && (
          <>
            {col.sortable && <Separator />}
            <div className="space-y-2 p-3">
              <div className="text-xs font-medium text-muted-foreground">
                {strings.condition}
              </div>
              {isDate ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label={strings.from}
                    className="h-8 text-xs"
                    value={draft.value}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, op: "between", value: e.target.value }))
                    }
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="date"
                    aria-label={strings.to}
                    className="h-8 text-xs"
                    value={draft.value2}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, op: "between", value2: e.target.value }))
                    }
                  />
                </div>
              ) : (
                <>
                  <Select
                    value={draft.op || undefined}
                    onValueChange={(v) =>
                      setDraft((d) => ({ ...d, op: v as GridConditionOp }))
                    }
                  >
                    <SelectTrigger className="h-8 w-full text-xs">
                      <SelectValue placeholder={strings.condition} />
                    </SelectTrigger>
                    <SelectContent>
                      {ops.map((op) => (
                        <SelectItem key={op} value={op}>
                          {strings.opLabels[op]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input
                      type={inputType}
                      className="h-8 text-xs"
                      placeholder={strings.value}
                      value={draft.value}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, value: e.target.value }))
                      }
                    />
                    {draft.op === "between" && (
                      <>
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type={inputType}
                          className="h-8 text-xs"
                          placeholder={strings.to}
                          value={draft.value2}
                          onChange={(e) =>
                            setDraft((d) => ({ ...d, value2: e.target.value }))
                          }
                        />
                      </>
                    )}
                  </div>
                </>
              )}
              {conditionTooShort && (
                <p className="text-xs text-destructive">
                  {strings.minChars(CONTAINS_MIN_CHARS)}
                </p>
              )}
            </div>
          </>
        )}

        {options.length > 0 && (
          <>
            <Separator />
            <div className="p-3 pb-2">
              <div className="relative">
                <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-8 pl-7 text-xs"
                  placeholder={strings.searchValues}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto px-3 pb-2">
              <label className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-accent">
                <Checkbox
                  checked={
                    allChecked
                      ? true
                      : checkedCount === 0
                        ? false
                        : "indeterminate"
                  }
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs font-medium">{strings.selectAll}</span>
              </label>
              {visible.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2 rounded p-1 hover:bg-accent"
                >
                  <Checkbox
                    checked={allChecked || !!draft.values?.has(o.value)}
                    onCheckedChange={() => toggleValue(o.value)}
                  />
                  <span className="truncate text-xs" title={o.label}>
                    {o.label}
                  </span>
                </label>
              ))}
              {options.length > LIST_RENDER_CAP &&
                visible.length === LIST_RENDER_CAP && (
                  <p className="p-1 text-xs text-muted-foreground">
                    {strings.showingCap(LIST_RENDER_CAP)}
                  </p>
                )}
            </div>
          </>
        )}

        {/* Freeze lives HERE, in the column menu, and not in the toolbar's
            column picker: the boundary is "up to this column", and the column
            that defines it is the one being looked at. It is also why this menu
            opens on EVERY column — freezing depends on neither a filter nor a
            sort. */}
        {(col.sortable || ops.length > 0 || options.length > 0) && (
          <Separator />
        )}
        <div className="p-1">
          <button
            type="button"
            className={MENU_ITEM_CLS}
            onClick={() => {
              setFrozen(index + 1);
              setOpen(false);
            }}
          >
            <Snowflake className="size-4 text-muted-foreground" />
            {strings.freezeToHere}
            {frozenCount === index + 1 && (
              <span className="ml-auto text-basecast-brand">✓</span>
            )}
          </button>
          {frozenCount > 0 && (
            <button
              type="button"
              className={MENU_ITEM_CLS}
              onClick={() => {
                setFrozen(0);
                setOpen(false);
              }}
            >
              <Snowflake className="size-4 text-muted-foreground opacity-40" />
              {strings.unfreeze}
            </button>
          )}
        </div>

        {(ops.length > 0 || options.length > 0) && (
          <>
            <Separator />
            <div className="flex justify-end gap-2 p-2">
              <Button variant="ghost" size="sm" onClick={clear}>
                {strings.clear}
              </Button>
              <Button size="sm" onClick={apply} disabled={nothingChecked}>
                {strings.apply}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
