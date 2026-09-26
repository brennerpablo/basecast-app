import type { Row } from "@tanstack/react-table";

import type { DataTableSectionDef, DataTableSectionsConfig } from "./types";

export type SectionedDisplayRow<TData> =
  | { kind: "section"; section: DataTableSectionDef; rowCount: number }
  | { kind: "data"; row: Row<TData> };

function bucketRowsBySection<TData>(
  tableRows: Row<TData>[],
  config: DataTableSectionsConfig<TData>,
): Map<string, Row<TData>[]> {
  const buckets = new Map<string, Row<TData>[]>();
  for (const section of config.sections) {
    buckets.set(section.id, []);
  }

  for (const row of tableRows) {
    const sectionId = config.getSectionId(row.original);
    const target =
      buckets.get(sectionId) ??
      (config.fallbackSectionId ? buckets.get(config.fallbackSectionId) : undefined);
    if (target) target.push(row);
  }

  return buckets;
}

/** Monta linhas virtuais (cabeçalho de seção + dados) após filtro/ordenação do TanStack. */
export function buildSectionedDisplayRows<TData>(
  tableRows: Row<TData>[],
  config: DataTableSectionsConfig<TData>,
  collapsedSectionIds: ReadonlySet<string>,
): SectionedDisplayRow<TData>[] {
  const buckets = bucketRowsBySection(tableRows, config);
  const display: SectionedDisplayRow<TData>[] = [];

  for (const section of config.sections) {
    const rowCount = buckets.get(section.id)?.length ?? 0;
    display.push({ kind: "section", section, rowCount });
    if (!collapsedSectionIds.has(section.id)) {
      for (const row of buckets.get(section.id) ?? []) {
        display.push({ kind: "data", row });
      }
    }
  }

  return display;
}

export function initialCollapsedSectionIds(
  sections: readonly DataTableSectionDef[],
): Set<string> {
  return new Set(
    sections.filter((section) => section.defaultCollapsed).map((section) => section.id),
  );
}
