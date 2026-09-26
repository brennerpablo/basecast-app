"use client";

import { DataTable } from "./DataTable";
import type { DataTableSectionsConfig } from "./types";

/** Props do DataTable com `matrixSections` obrigatório (modos incompatíveis omitidos no tipo). */
export type DataTableSectionedProps<TData> = Omit<
  React.ComponentProps<typeof DataTable<TData>>,
  "matrixSections" | "expandableGroups" | "serverPagination"
> & {
  matrixSections: DataTableSectionsConfig<TData>;
};

/** Wrapper fino: seções colapsáveis via `matrixSections` no DataTable. */
export function DataTableSectioned<TData>({
  matrixSections,
  ...props
}: DataTableSectionedProps<TData>) {
  return <DataTable {...props} matrixSections={matrixSections} />;
}

export type { DataTableSectionDef, DataTableSectionsConfig } from "./types";
