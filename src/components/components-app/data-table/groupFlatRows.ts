import type { DataTableExpandableGroupsConfig } from "./types"

export type GroupedParentsResult<TData> = {
  parentRows: TData[]
  childrenByGroupId: Map<string, TData[]>
}

/**
 * Agrupa linhas já filtradas; uma linha pai por grupo + mapa de histórico (filhos).
 */
export function groupFlatRowsForExpandableTable<TData>(
  filteredFlat: TData[],
  config: DataTableExpandableGroupsConfig<TData>,
): GroupedParentsResult<TData> {
  const groups = new Map<string, TData[]>()
  for (const row of filteredFlat) {
    const id = config.getGroupId(row)
    if (!groups.has(id)) groups.set(id, [])
    groups.get(id)!.push(row)
  }

  const parentRows: TData[] = []
  const childrenByGroupId = new Map<string, TData[]>()

  for (const [groupId, members] of groups) {
    const primary = config.pickPrimaryRow(members)
    let children: TData[]
    if (config.getChildRows) {
      children = config.getChildRows(primary, members)
    } else {
      children = members.filter((r) => r !== primary)
      if (config.sortChildRows) {
        children = [...children].sort((a, b) => config.sortChildRows!(a, b))
      }
    }
    parentRows.push(primary)
    childrenByGroupId.set(groupId, children)
  }

  return { parentRows, childrenByGroupId }
}
