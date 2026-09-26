import { CellContext, ColumnFiltersState, HeaderContext, PaginationState, SortingFnOption, SortingState } from "@tanstack/react-table"
import * as React from "react"
import { ReactNode } from "react"

import type { DateRangePreset } from "@/components/fields/date-range/types"
import { BRAND_CSS } from "@/lib/brand-tokens"

export function resolveAccentColor(accentColor?: string): string {
  if (!accentColor) return BRAND_CSS.brand;
  if (
    accentColor.startsWith("#") ||
    accentColor.startsWith("rgb") ||
    accentColor.startsWith("hsl")
  ) {
    return accentColor;
  }
  return `var(--color-${accentColor})`;
}

export type OptionItem = {
  value: string
  label: string
}

export type FilterConfig = {
  text?: boolean                                     // debounced text search input
  textColumns?: string[]                             // additional data field keys searched alongside the primary column (supports fields not declared as columns)
  select?: boolean                                   // single-value dropdown filter
  checkbox?: boolean                                 // multi-value checkbox filter (arrIncludesSome)
  /** Cell value is string[]; match when any selected filter value is in the array. */
  checkboxArray?: boolean
  checkboxSearch?: boolean | { multiple?: boolean }  // checkbox list with search; multiple defaults to true
  number?: boolean                                   // condition + value filter (only for type "number")
  percentage?: boolean                               // min/max range slider filter (0–100)
  date?: boolean                                     // date range calendar filter (start/end dates)
  dateSingle?: boolean                               // single-date calendar filter; with inferOptions/options only dates present in the data are selectable
}

export type ColumnType = "text" | "number" | "date"

type ColumnTypeMap = { text: string; number: number; date: Date }

export type ColumnLinkVariant = "primary" | "default" | "mono" | "asset" | "muted"

export type ColumnLinkConfig<TData> = {
  href: (row: TData) => string | null | undefined
  label?: (row: TData) => ReactNode
  /** Rendered below the link, outside the clickable area. */
  subtitle?: (row: TData) => ReactNode
  title?: (row: TData) => string | undefined
  variant?: ColumnLinkVariant
  className?: string
  subtitleClassName?: string
  onClick?: (row: TData, event: React.MouseEvent<HTMLAnchorElement>) => void
}

export type InferRowType<T extends readonly ColumnMetadata[]> = {
  [K in T[number] as K["columnId"]]: K["type"] extends keyof ColumnTypeMap
    ? ColumnTypeMap[K["type"]]
    : unknown
}

/** Config do modo "expandable groups": um payload plano agrupado por chave; sub-tabela = restantes do grupo. */
export type DataTableExpandableGroupsConfig<TData> = {
  getGroupId: (row: TData) => string
  pickPrimaryRow: (rows: TData[]) => TData
  /** Ordenação dos filhos na sub-tabela (ex.: mais recente primeiro). Default: ordem estável do filtro. */
  sortChildRows?: (a: TData, b: TData) => number
  /** Se definido, substitui a regra default "todos os membros exceto o primary". */
  getChildRows?: (primary: TData, members: TData[]) => TData[]
}

export type DataTableRenderSubTableArgs<TData> = {
  primary: TData
  children: TData[]
  groupId: string
}

/** Ações à direita do título da sub-tabela (expand); mesmos args que `renderSubTable`. */
export type DataTableSubTableHeaderActions<TData> = (args: DataTableRenderSubTableArgs<TData>) => ReactNode

export type DataTableSectionDef = {
  id: string
  label: string
  defaultCollapsed?: boolean
}

export type DataTableSectionsConfig<TData> = {
  sections: readonly DataTableSectionDef[]
  getSectionId: (row: TData) => string
  fallbackSectionId?: string
  renderSectionHeader?: (args: {
    section: DataTableSectionDef
    collapsed: boolean
    onToggle: () => void
    rowCount: number
  }) => ReactNode
}

/**
 * Opt-in server-pagination mode. When provided, DataTable hands pagination,
 * sorting and filtering over to the parent: tanstack-table switches into
 * controlled/manual mode. Pass `isFetching` for a subtle "loading" state
 * during page transitions.
 *
 * Per-column filter UI:
 * - If `columnFilters` + `onColumnFiltersChange` are provided, the filter
 *   bar renders and changes flow up to the parent (which translates them
 *   into server query params and resets to page 0).
 * - If they are omitted, per-column filter UI is suppressed — the parent
 *   is expected to drive filtering from an external form.
 */
export type ServerPaginationConfig = {
  totalRows: number
  pagination: PaginationState
  onPaginationChange: React.Dispatch<React.SetStateAction<PaginationState>>
  sorting: SortingState
  onSortingChange: React.Dispatch<React.SetStateAction<SortingState>>
  columnFilters?: ColumnFiltersState
  onColumnFiltersChange?: React.Dispatch<React.SetStateAction<ColumnFiltersState>>
  /**
   * Override the built-in download button. In server mode the default
   * exporter only sees the current page (25 rows), which is almost never
   * what the user wants — provide a callback that hits an export-all
   * endpoint and the toolbar replaces its CSV/XLSX dropdown with a
   * single icon button wired to this handler.
   */
  onDownload?: () => void | Promise<void>
  isFetching?: boolean
}

export type ColumnMetadata<TData = Record<string, unknown>> = {
  columnId: keyof TData & string
  title: string
  subtitle?: string
  description?: string
  type: ColumnType
  sortable?: boolean
  /** Override TanStack's auto-detected sortingFn (e.g. `"datetime"` for ISO date strings, custom comparator for mixed types). */
  sortingFn?: SortingFnOption<TData>
  hideable?: boolean
  /** Default true. Quando false, a coluna inicia oculta (Propriedades de exibição). */
  defaultVisible?: boolean
  /**
   * Filter choices. Alone, this is the whole list. Combined with `inferOptions`
   * it degrades to a label dictionary: the list still comes from the data, and
   * each value shows the matching label — falling back to the raw value — so an
   * incomplete dictionary loses no rows.
   */
  options?: OptionItem[]
  /** Derive the filter choices from the values present in the data. */
  inferOptions?: boolean
  filters?: FilterConfig
  /** Filter-only column: hidden from table and column options menu, but filter still shows in toolbar. */
  filterOnly?: boolean
  /**
   * Atalhos de período do filtro `date`, na coluna à esquerda dos calendários
   * («Últimos 30 dias», «Este ano»…). Default: `defaultDateRangePresets` de
   * `components/fields/date-range`. App-only (fork): o upstream não tem presets.
   */
  datePresets?: DateRangePreset[]
  aligned?: "left" | "center" | "right"
  /** Classes aplicadas ao `<th>` e `<td>` desta coluna (ex.: `max-w-*`, `whitespace-normal`). */
  columnClassName?: string
  formatter?: (value: unknown) => ReactNode
  filterValueFormatter?: (value: number) => string
  link?: ColumnLinkConfig<TData>
  cell?: (props: CellContext<TData, unknown>) => ReactNode
  header?: (props: HeaderContext<TData, unknown>) => ReactNode
}

/** Metadados em cada linha plana derivada da árvore (filtros, export). */
export type MultilevelRowMeta = {
  __nodeKey: string
  __label: string
  __subtitle?: string
  /** Texto usado só em filtros de busca hierárquica (ex.: cedente/sacado, sem parcelas). */
  __hierarchySearch?: string
  __flags?: string[]
  __depth: number
}

export type MultilevelTreeNode<TPayload = unknown> = {
  key: string
  label: ReactNode
  subtitle?: ReactNode
  /** Se definido, entra no filtro de busca da hierarquia; omitir em níveis que não devem ser pesquisados (ex.: parcela). */
  hierarchySearch?: string
  flags?: string[]
  /** Rótulo do nível (ex.: cedente, sacado, parcela) para UI hierárquica. */
  level?: string
  payload?: TPayload
  children?: MultilevelTreeNode<TPayload>[]
  /**
   * Filhos ainda não materializados na árvore (ex.: parcelas paginadas sob sacado).
   * Usado para exibir expand e contagem antes do carregamento.
   */
  descendantCount?: number
}

export type MultilevelToggleExpandArgs<TPayload = unknown> = {
  nodeId: string
  expanded: boolean
  node: MultilevelTreeNode<TPayload>
  /** Profundidade visual na árvore (0 = raiz). */
  depth?: number
}

export type MultilevelCellContext<TPayload> = {
  node: MultilevelTreeNode<TPayload>
  depth: number
  hasChildren: boolean
}

export type MultilevelHierarchyCellContext<TPayload> = MultilevelCellContext<TPayload> & {
  indentPx: number
}

export type MultilevelLazyRenderStats = {
  active: boolean
  originalRows: number
  visualRows: number
  omittedRows: number
  truncatedNodes: number
  maxChildrenPerNode: number
}

export type MultilevelLazyRenderAggregateArgs<TPayload> = {
  parent: MultilevelTreeNode<TPayload>
  parentDepth: number
  visibleChildren: MultilevelTreeNode<TPayload>[]
  omittedChildren: MultilevelTreeNode<TPayload>[]
  omittedCount: number
}

/** Nível hierárquico configurável (id = `MultilevelTreeNode.level`). */
export type MultilevelHierarchyLevelDef = {
  id: string
  label: string
  /** Default true. Níveis ocultos têm filhos promovidos ao ancestral visível. */
  defaultVisible?: boolean
}

export type MultilevelLazyRenderConfig<TPayload = unknown> = {
  enabled?: boolean
  enabledAboveRows?: number
  maxChildrenPerNode: number
  shouldLimitNode?: (node: MultilevelTreeNode<TPayload>, depth: number) => boolean
  createAggregateNode?: (args: MultilevelLazyRenderAggregateArgs<TPayload>) => MultilevelTreeNode<TPayload>
  renderNotice?: (stats: MultilevelLazyRenderStats) => ReactNode
}
/** Props alinhadas ao `DataTable` (toolbar, export, colunas). */
export type DataTableMultilevelProps<TPayload = unknown> = {
  tree: MultilevelTreeNode<TPayload>[]
  columnsMetadata: readonly ColumnMetadata<TPayload & MultilevelRowMeta>[]
  hierarchyColumnTitle?: ReactNode
  /** Classes da coluna hierarquia (corpo e cabeçalho). Ex.: largura fixa + `whitespace-normal`. */
  hierarchyColumnClassName?: string
  /**
   * Congela o expansor e a coluna de hierarquia à esquerda na rolagem
   * horizontal. Opt-in: sem isto o comportamento é o de sempre.
   *
   * Existe para tabela LARGA — uma coluna por período, por exemplo. Rolando até
   * a última data sem isto, o leitor perde o nome da linha e fica com um número
   * sem dono, que é o defeito clássico deste formato.
   *
   * As duas células congeladas ganham fundo opaco próprio: sem ele o conteúdo
   * que rola passa por baixo e se lê através. O tom levemente distinto do resto
   * da linha é aceito de propósito — é o que marca o painel congelado.
   */
  pinHierarchyColumn?: boolean
  /**
   * Clique numa célula de DADOS (não na hierarquia). Opt-in: sem isto o
   * comportamento é o de sempre, e nenhuma tela existente muda.
   *
   * Existe para drill: a célula sabe qual nó e qual coluna a produziram, que é
   * tudo o que um detalhe precisa para se abrir sem o usuário remontar filtro.
   */
  onCellClick?: (node: MultilevelTreeNode<TPayload>, columnId: string) => void
  /** Só as células que isto aprova ficam clicáveis. Ausente = nenhuma. */
  isCellClickable?: (node: MultilevelTreeNode<TPayload>, columnId: string) => boolean
  renderHierarchyCell?: (ctx: MultilevelHierarchyCellContext<TPayload>) => ReactNode
  getNodeId?: (node: MultilevelTreeNode<TPayload>) => string
  defaultExpandedDepth?: number
  /** Profundidade máxima do botão “expandir tudo” (nós com `depth < max`). */
  expandAllMaxDepth?: number
  /** Níveis omitidos da assinatura de expansão (ex. parcelas lazy). Default: `parcela`. */
  expansionSignatureIgnoreLevels?: readonly string[]
  indentPxPerDepth?: number
  emptyMessage?: string
  persistColumnOrder?: boolean
  /** A ordem das colunas é DADO (sequência de datas), não preferência do usuário. */
  columnOrderFollowsData?: boolean
  tableName?: string
  enableDownload?: boolean
  enableColumnOptions?: boolean
  /** Botões expandir/recolher tudo na toolbar. Default: true. */
  enableTreeExpansionControls?: boolean
  /**
   * Níveis da árvore (ex.: cedente, sacado, parcela). Exibe botão na toolbar
   * (estilo "Visualizar" das colunas) para mostrar/ocultar níveis sem quebrar a hierarquia.
   */
  hierarchyLevels?: readonly MultilevelHierarchyLevelDef[]
  /** Persiste seleção em localStorage (`data-table-hierarchy-levels:{tableName}`). */
  persistHierarchyLevels?: boolean
  /** Controle externo dos níveis visíveis (ids de `hierarchyLevels`). */
  visibleLevelIds?: string[]
  onVisibleLevelIdsChange?: (levelIds: string[]) => void
  toolbarIconsOnly?: boolean
  enableFullscreen?: boolean
  /** Cabeçalho flutuante quando o real sai da viewport. Mesma prop do `DataTable`. */
  stickyHeader?: boolean
  /** Folga em px acima do cabeçalho flutuante. Default: 16 (inset `p-4` do shell). */
  stickyHeaderOffset?: number
  /** `false` deixa o cabeçalho flutuante apenas como rótulos (sem ordenar). */
  stickyHeaderSortable?: boolean
  compact?: boolean
  bordered?: boolean
  language?: import("./i18n").DataTableLanguage
  accentColor?: string
  className?: string
  fetching?: boolean
  lazyRender?: MultilevelLazyRenderConfig<TPayload>
  /** Disparado ao expandir/recolher um nó (ex.: carregar filhos paginados). */
  onToggleExpand?: (args: MultilevelToggleExpandArgs<TPayload>) => void
  /** Conteúdo antes dos filhos expandidos (ex.: paginação no topo da seção). */
  renderNodeHeader?: (args: MultilevelToggleExpandArgs<TPayload>) => ReactNode
  /** Rodapé após os filhos de um nó. */
  renderNodeFooter?: (args: MultilevelToggleExpandArgs<TPayload>) => ReactNode
  /** Export global server-side (substitui CSV/XLSX apenas da árvore visível). */
  onServerExport?: (format: "csv" | "xlsx") => void | Promise<void>
  /** Conteúdo extra na toolbar (ex.: ações lazy). */
  toolbarEndExtras?: ReactNode
}

/** @deprecated Use `ColumnMetadata` + `DataTableMultilevel`. */
export type MultilevelColumnDef<TPayload = unknown> = {
  id: string
  title: ReactNode
  align?: "left" | "center" | "right"
  headerClassName?: string
  cellClassName?: string
  cell: (ctx: MultilevelCellContext<TPayload>) => ReactNode
}
