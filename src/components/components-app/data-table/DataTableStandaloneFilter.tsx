"use client";

import type { Column } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import React from "react";

import { cn } from "@/lib/utils";

import { DataTableFilter, type FilterValues } from "./DataTableFilter";

type StandaloneFilterProps = Omit<
  React.ComponentProps<typeof DataTableFilter>,
  "column"
> & {
  value: FilterValues;
  onChange: (value: FilterValues) => void;
};

/**
 * Um filtro da barra da DataTable que não filtra coluna nenhuma: o valor é do
 * chamador (ex.: o período que vai para a consulta do servidor). Mesmo gatilho,
 * mesmo popover e mesmo «Aplicar» dos filtros de coluna — vai no `filterExtras`.
 *
 * O `DataTableFilter` só chama `getFilterValue`/`setFilterValue`, então a coluna
 * é um adaptador de duas funções. **`value` tem de ser estável entre renders**
 * (memoize no chamador): o filtro sincroniza o rascunho num efeito que depende
 * dele, e um objeto novo a cada render entraria em laço.
 */
export function DataTableStandaloneFilter({
  value,
  onChange,
  ...props
}: StandaloneFilterProps) {
  const column = React.useMemo(
    () =>
      ({
        getFilterValue: () => value,
        setFilterValue: (next: FilterValues) => onChange(next),
      }) as unknown as Column<unknown, unknown>,
    [value, onChange],
  );
  return <DataTableFilter column={column} {...props} />;
}

/**
 * Liga/desliga com a cara de um filtro da barra: tracejado quando desligado,
 * tingido do acento e com o «+» virado em «×» quando ligado. Para opção binária
 * que não cabe num popover com «Aplicar» (ex.: «Incluir navegação»).
 */
export function DataTableToggleFilter({
  title,
  checked,
  onCheckedChange,
}: {
  title: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "flex w-full items-center gap-x-1.5 whitespace-nowrap rounded-md border px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted sm:w-fit sm:text-xs",
        checked ? "" : "border-dashed border-border",
      )}
      style={
        checked
          ? {
              backgroundColor:
                "color-mix(in srgb, var(--dt-accent) 10%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--dt-accent) 35%, transparent)",
            }
          : undefined
      }
    >
      <Plus
        className={cn(
          "-ml-px size-5 shrink-0 transition sm:size-4",
          checked && "rotate-45",
        )}
        aria-hidden="true"
      />
      <span>{title}</span>
    </button>
  );
}
