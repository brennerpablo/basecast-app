"use client";

/**
 * Tabela hierárquica N níveis integrada ao ecossistema DataTable:
 * `ColumnMetadata`, Filterbar, ViewOptions, export CSV/XLSX.
 *
 * Mesmo padrão do modo `expandableGroups`: `filterSourceTable` (linhas planas da árvore)
 * alimenta filtros; `table` controla colunas visíveis e export; corpo renderiza a árvore.
 *
 * Para dados planos com um nível de agrupamento e sub-tabela com colunas distintas,
 * use `DataTable` + `expandableGroups` + `subTableColumnsMetadata`.
 */
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  type SortingState,
  type Updater,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import * as React from "react";
import ReactDOM from "react-dom";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { buildColumnsFromMetadata, buildDefaultColumnVisibility, buildOptionLabelLookup } from "../columnBuilder";
import { Filterbar } from "../DataTableFilterbar";
import { DataTableLocaleContext } from "../DataTableLocaleContext";
import { DataTableStickyHeader } from "../DataTableStickyHeader";
import { getLocale } from "../i18n";
import type { DataTableMultilevelProps } from "../types";
import { resolveAccentColor } from "../types";
import { createHierarchyColumn } from "./buildMultilevelColumns";
import {
  createMultilevelExpandColumn,
  DataTableMultilevelRow,
} from "./DataTableMultilevelRow";
import { defaultHierarchyCell } from "./defaultHierarchyCell";
import { filterMultilevelTreeByLevels } from "./filterMultilevelTreeByLevels";
import { MultilevelExpansionControls } from "./MultilevelExpansionControls";
import {
  MultilevelHierarchyLevelOptions,
  useMultilevelVisibleLevels,
} from "./MultilevelHierarchyLevelOptions";
import {
  applyMultilevelLazyRender,
  childCountFromTree,
  collectAllNodeKeys,
  countMultilevelTreeRows,
  flattenMultilevelTree,
  pruneMultilevelTree,
} from "./treeUtils";
import { collectExpandableParentIds,useMultilevelExpansion } from "./useMultilevelExpansion";

function defaultGetNodeId<TPayload>(node: import("../types").MultilevelTreeNode<TPayload>) {
  return node.key;
}

function isEmptySortValue(value: unknown) {
  return value === null || value === undefined || value === "";
}

/**
 * Ordena cada nível da árvore pela coluna ativa, preservando a hierarquia: os
 * filhos continuam sob o mesmo pai, só a ordem dentro de cada lista muda.
 *
 * O valor vem de `payload[columnId]` — a mesma chave que alimenta a célula —, o
 * que exige que colunas com `cell` customizada mantenham o valor bruto no
 * payload (é o caso das colunas de data da matriz de enquadramento). Vazios
 * ficam sempre no fim, nos dois sentidos: alternar para desc não deve promover
 * um bando de "—" ao topo.
 */
function sortMultilevelTree<TPayload>(
  nodes: import("../types").MultilevelTreeNode<TPayload>[],
  sort: { id: string; desc: boolean } | undefined,
): import("../types").MultilevelTreeNode<TPayload>[] {
  if (!sort) return nodes;
  const { id, desc } = sort;

  const readValue = (node: import("../types").MultilevelTreeNode<TPayload>) =>
    (node.payload as Record<string, unknown> | undefined)?.[id];

  const compare = (a: unknown, b: unknown) => {
    const numA = Number(a);
    const numB = Number(b);
    if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
    return String(a).localeCompare(String(b), "en-US");
  };

  const sortLevel = (
    list: import("../types").MultilevelTreeNode<TPayload>[],
  ): import("../types").MultilevelTreeNode<TPayload>[] =>
    [...list]
      .sort((a, b) => {
        const valueA = readValue(a);
        const valueB = readValue(b);
        const emptyA = isEmptySortValue(valueA);
        const emptyB = isEmptySortValue(valueB);
        if (emptyA || emptyB) return emptyA === emptyB ? 0 : emptyA ? 1 : -1;
        const result = compare(valueA, valueB);
        return desc ? -result : result;
      })
      .map((node) =>
        node.children?.length ? { ...node, children: sortLevel(node.children) } : node,
      );

  return sortLevel(nodes);
}

function buildChildCountMap<TPayload>(
  nodes: import("../types").MultilevelTreeNode<TPayload>[],
  getNodeId: (node: import("../types").MultilevelTreeNode<TPayload>) => string,
): Map<string, number> {
  const map = new Map<string, number>();
  const walk = (list: import("../types").MultilevelTreeNode<TPayload>[]) => {
    for (const node of list) {
      map.set(getNodeId(node), childCountFromTree(node));
      if (node.children?.length) walk(node.children);
    }
  };
  walk(nodes);
  return map;
}

export function DataTableMultilevel<TPayload = unknown>({
  tree,
  columnsMetadata,
  hierarchyColumnTitle = "Hierarquia",
  hierarchyColumnClassName,
  renderHierarchyCell = defaultHierarchyCell,
  getNodeId = defaultGetNodeId,
  defaultExpandedDepth = 1,
  expandAllMaxDepth,
  expansionSignatureIgnoreLevels,
  indentPxPerDepth = 20,
  emptyMessage,
  persistColumnOrder = false,
  columnOrderFollowsData = false,
  tableName,
  enableDownload = true,
  enableColumnOptions = true,
  enableTreeExpansionControls = true,
  hierarchyLevels,
  persistHierarchyLevels = true,
  visibleLevelIds: visibleLevelIdsProp,
  onVisibleLevelIdsChange,
  toolbarIconsOnly = false,
  enableFullscreen = false,
  stickyHeader = false,
  stickyHeaderOffset,
  stickyHeaderSortable = true,
  pinHierarchyColumn = false,
  onCellClick,
  isCellClickable,
  compact = false,
  bordered = true,
  language = "en",
  accentColor,
  className,
  fetching = false,
  lazyRender,
  onToggleExpand,
  renderNodeHeader,
  renderNodeFooter,
  onServerExport,
  toolbarEndExtras,
}: DataTableMultilevelProps<TPayload>) {
  const locale = getLocale(language);
  const hierarchyStorageKey =
    persistHierarchyLevels && tableName ? tableName : undefined;

  const { visibleLevelIds, visibleSet, setVisibleLevelIds } = useMultilevelVisibleLevels({
    levels: hierarchyLevels ?? [],
    storageKey: hierarchyStorageKey,
    visibleLevelIds: visibleLevelIdsProp,
    onVisibleLevelIdsChange,
  });

  const levelFilteredTree = React.useMemo(() => {
    if (!hierarchyLevels?.length) return tree;
    return filterMultilevelTreeByLevels(tree, visibleSet);
  }, [tree, hierarchyLevels, visibleSet]);

  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const toggleFullscreen = React.useCallback(() => setIsFullscreen((v) => !v), []);

  React.useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const originalRowCount = React.useMemo(
    () => countMultilevelTreeRows(levelFilteredTree),
    [levelFilteredTree],
  );
  const lazyRenderActive = Boolean(
    lazyRender && (lazyRender.enabled ?? originalRowCount > (lazyRender.enabledAboveRows ?? Number.POSITIVE_INFINITY)),
  );
  const lazyRenderResult = React.useMemo(() => {
    if (!lazyRender || !lazyRenderActive) {
      return {
        tree,
        stats: {
          active: false,
          originalRows: originalRowCount,
          visualRows: originalRowCount,
          omittedRows: 0,
          truncatedNodes: 0,
          maxChildrenPerNode: lazyRender?.maxChildrenPerNode ?? 0,
        },
      };
    }
    return applyMultilevelLazyRender(tree, lazyRender);
  }, [tree, lazyRender, lazyRenderActive, originalRowCount]);
  const visualTree = lazyRenderResult.tree;
  const lazyRenderStats = lazyRenderResult.stats;

  const flatRows = React.useMemo(
    () => flattenMultilevelTree(visualTree),
    [visualTree],
  );

  const enrichedMetadata = React.useMemo(() => {
    if (!columnsMetadata?.length) return columnsMetadata;
    return columnsMetadata.map((col) => {
      if (!col.inferOptions) return col;
      const labelFor = buildOptionLabelLookup(col);
      const seen = new Set<string>();
      const options: { value: string; label: string }[] = [];
      for (const row of flatRows) {
        const raw = (row as Record<string, unknown>)[col.columnId];
        const val = raw == null ? "" : String(raw);
        if (!seen.has(val)) {
          seen.add(val);
          options.push({ value: val, label: labelFor(val) });
        }
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      return { ...col, options };
    });
  }, [columnsMetadata, flatRows]);

  const builtDataColumns = React.useMemo(() => {
    return enrichedMetadata?.length ? buildColumnsFromMetadata(enrichedMetadata) : [];
  }, [enrichedMetadata]);

  const filterOnlyColumnIds = React.useMemo(
    () => (columnsMetadata ?? []).flatMap((c) => c.filterOnly ? [c.columnId] : []),
    [columnsMetadata],
  );
  const hasFiltersOnly = filterOnlyColumnIds.length > 0;

  const defaultColumnVisibility = React.useMemo(
    () => buildDefaultColumnVisibility(columnsMetadata),
    [columnsMetadata],
  );
  const needsColumnVisibilityControl =
    enableColumnOptions ||
    hasFiltersOnly ||
    Object.keys(defaultColumnVisibility).length > 0;

  const [userColumnVisibility, setUserColumnVisibility] = React.useState<VisibilityState>({});

  const mergedColumnVisibility = React.useMemo(() => {
    const merged: VisibilityState = { ...defaultColumnVisibility, ...userColumnVisibility };
    for (const id of filterOnlyColumnIds) {
      merged[id] = false;
    }
    return merged;
  }, [defaultColumnVisibility, userColumnVisibility, filterOnlyColumnIds]);

  const handleColumnVisibilityChange = React.useCallback(
    (updater: Updater<VisibilityState>) => {
      setUserColumnVisibility((prev) => {
        if (!hasFiltersOnly) {
          const full: VisibilityState = { ...defaultColumnVisibility, ...prev };
          const updated = typeof updater === "function" ? updater(full) : updater;
          const next: VisibilityState = { ...prev };
          for (const [k, val] of Object.entries(updated)) {
            if (!(filterOnlyColumnIds as string[]).includes(k)) {
              next[k] = val;
            }
          }
          return next;
        }
        const full: VisibilityState = { ...defaultColumnVisibility, ...prev };
        for (const id of filterOnlyColumnIds) {
          full[id] = false;
        }
        const updated = typeof updater === "function" ? updater(full) : updater;
        const next: VisibilityState = { ...prev };
        for (const [k, val] of Object.entries(updated)) {
          if (!(filterOnlyColumnIds as string[]).includes(k)) {
            next[k] = val;
          }
        }
        return next;
      });
    },
    [defaultColumnVisibility, filterOnlyColumnIds, hasFiltersOnly],
  );

  const { expandedIds, toggle, expandAll, collapseAll } = useMultilevelExpansion({
    tree: visualTree,
    getNodeId,
    defaultExpandedDepth,
    expandAllMaxDepth,
    signatureIgnoreLevels: expansionSignatureIgnoreLevels,
  });

  const childCountByKey = React.useMemo(
    () => buildChildCountMap(visualTree, getNodeId),
    [visualTree, getNodeId],
  );

  const nodeById = React.useMemo(() => {
    const map = new Map<string, import("../types").MultilevelTreeNode<TPayload>>();
    const walk = (list: import("../types").MultilevelTreeNode<TPayload>[]) => {
      for (const node of list) {
        map.set(getNodeId(node), node);
        if (node.children?.length) walk(node.children);
      }
    };
    walk(visualTree);
    return map;
  }, [visualTree, getNodeId]);

  const toggleExpanded = React.useCallback(
    (id: string) => {
      const wasExpanded = expandedIds.has(id);
      toggle(id);
      if (onToggleExpand) {
        const node = nodeById.get(id);
        if (node) {
          onToggleExpand({ nodeId: id, expanded: !wasExpanded, node });
        }
      }
    },
    [toggle, expandedIds, onToggleExpand, nodeById],
  );

  const allColumns = React.useMemo(() => {
    return [
      createMultilevelExpandColumn<TPayload>({
        expandedIds,
        toggleExpanded,
        childCountByKey,
      }),
      createHierarchyColumn<TPayload>(
        String(hierarchyColumnTitle),
        hierarchyColumnClassName,
      ),
      ...builtDataColumns,
    ];
  }, [
    expandedIds,
    toggleExpanded,
    childCountByKey,
    hierarchyColumnTitle,
    hierarchyColumnClassName,
    builtDataColumns,
  ]);

  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  // A ordenação é aplicada por nível na árvore (`sortedTree`), não no row model:
  // ordenar as linhas planas dissolveria a hierarquia. O estado mora aqui só para
  // o cabeçalho saber o que está ativo e alternar asc/desc/nenhum.
  const [sorting, setSorting] = React.useState<SortingState>([]);

  const table = useReactTable({
    data: flatRows,
    columns: allColumns,
    getRowId: (row) => row.__nodeKey,
    state: {
      columnFilters,
      sorting,
      ...(needsColumnVisibilityControl
        ? { columnVisibility: mergedColumnVisibility }
        : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    ...(needsColumnVisibilityControl
      ? { onColumnVisibilityChange: handleColumnVisibilityChange }
      : {}),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const filteredKeys = React.useMemo(() => {
    if (columnFilters.length === 0) return collectAllNodeKeys(visualTree, getNodeId);
    return new Set(
      table.getFilteredRowModel().rows.map((r) => r.original.__nodeKey),
    );
    // `table` muda a cada render; filtros dependem de columnFilters + dados/colunas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnFilters, flatRows, allColumns, visualTree, getNodeId]);

  const prunedTree = React.useMemo(
    () => pruneMultilevelTree(visualTree, filteredKeys, getNodeId),
    [visualTree, filteredKeys, getNodeId],
  );

  const displayTree = React.useMemo(
    () => sortMultilevelTree(prunedTree, sorting[0]),
    [prunedTree, sorting],
  );

  const hasExpandableNodes = React.useMemo(
    () => collectExpandableParentIds(displayTree, getNodeId).size > 0,
    [displayTree, getNodeId],
  );

  const handleExpandAll = React.useCallback(() => {
    expandAll(displayTree);
  }, [displayTree, expandAll]);

  const handleCollapseAll = React.useCallback(() => {
    collapseAll();
  }, [collapseAll]);

  const showFetchingOverlay = fetching;

  // Medidos pelo clone flutuante do cabeçalho (`stickyHeader`).
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const tableElementRef = React.useRef<HTMLTableElement | null>(null);
  const headerElementRef = React.useRef<HTMLTableSectionElement | null>(null);

  if (visualTree.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage ?? locale.noResults}
      </p>
    );
  }

  // Montadas uma vez e renderizadas no cabeçalho real e no clone flutuante — a
  // identidade compartilhada mantém a ordenação funcionando nos dois.
  const headerRows = table.getHeaderGroups().map((headerGroup) => (
    <TableRow key={headerGroup.id} className="border-border bg-muted/50 hover:bg-muted/50">
      {headerGroup.headers.map((header, index) => (
        <TableHead
          key={header.id}
          className={cn(
            compact
              ? "whitespace-nowrap py-0.5 text-sm sm:text-xs"
              : "whitespace-nowrap py-2 text-sm sm:text-xs",
            bordered && "first:pl-1 last:pr-4",
            header.column.columnDef.meta?.className,
            // `columnClassName` descreve as células de DADOS (`align-top` para
            // colunas com texto multi-linha, `text-foreground` na hierarquia),
            // mas cai também no cabeçalho. Sem isto, um rótulo alinha no topo
            // enquanto os outros centralizam, e a hierarquia fica de outra cor.
            // Reaplicados por último para vencerem no twMerge.
            "align-middle text-muted-foreground",
            pinHierarchyColumn && "border-b border-border",
            // As duas primeiras colunas são o expansor e a hierarquia, nesta
            // ordem (ver `allColumns`). `bg-muted` opaco em vez do `bg-muted/50`
            // translúcido da linha: sem opacidade total, as datas que rolam
            // aparecem por baixo do rótulo congelado.
            pinHierarchyColumn && index === 0 && "sticky left-0 z-30 bg-muted",
            pinHierarchyColumn &&
              index === 1 &&
              "sticky left-9 z-30 border-r border-border bg-muted",
          )}
        >
          {header.isPlaceholder
            ? null
            : flexRender(header.column.columnDef.header, header.getContext())}
        </TableHead>
      ))}
    </TableRow>
  ));

  const tableContent = (
    <DataTableLocaleContext.Provider value={locale}>
      <div
        className={cn(
          "space-y-3 transition-opacity duration-300",
          showFetchingOverlay && "pointer-events-none opacity-50",
          className,
        )}
        style={{ "--dt-accent": resolveAccentColor(accentColor) } as React.CSSProperties}
      >
        {lazyRenderActive && lazyRender?.renderNotice ? lazyRender.renderNotice(lazyRenderStats) : null}
        <Filterbar
          table={table}
          columnsMetadata={enrichedMetadata}
          persistColumnOrder={persistColumnOrder}
          columnOrderFollowsData={columnOrderFollowsData}
          tableName={tableName}
          accentColor={accentColor}
          isFullscreen={isFullscreen}
          onToggleFullscreen={enableFullscreen ? toggleFullscreen : undefined}
          enableDownload={enableDownload}
          enableColumnOptions={enableColumnOptions}
          toolbarIconsOnly={toolbarIconsOnly}
          onServerExport={onServerExport}
          // Expandir/recolher abre a toolbar: agem sobre as linhas, não sobre a
          // tabela como um todo (exportar, colunas, tela cheia).
          toolbarExtrasLeading={
            enableTreeExpansionControls ? (
              <MultilevelExpansionControls
                onExpandAll={handleExpandAll}
                onCollapseAll={handleCollapseAll}
                iconsOnly={toolbarIconsOnly}
                disabled={!hasExpandableNodes}
              />
            ) : undefined
          }
          toolbarExtras={
            hierarchyLevels?.length || toolbarEndExtras ? (
              <>
                {hierarchyLevels?.length ? (
                  <MultilevelHierarchyLevelOptions
                    levels={hierarchyLevels}
                    visibleLevelIds={visibleLevelIds}
                    onVisibleLevelIdsChange={setVisibleLevelIds}
                    iconsOnly={toolbarIconsOnly}
                  />
                ) : null}
                {toolbarEndExtras}
              </>
            ) : undefined
          }
        />
        <div
          ref={scrollContainerRef}
          className={cn(
            "relative overflow-hidden overflow-x-auto",
            bordered && "rounded-md border border-border",
          )}
        >
          <Table
            ref={tableElementRef}
            // `position: sticky` em `<td>` é IGNORADO quando a tabela está em
            // `border-collapse: collapse` — e o preflight do Tailwind aplica
            // exatamente isso em toda `table`. Sem `border-separate` a coluna
            // congelada simplesmente não congela, e os dados que rolam passam
            // por cima do rótulo da linha. `border-spacing-0` mantém o desenho
            // idêntico ao de antes; as bordas continuam vindo do `border-b` das
            // linhas.
            className={cn(pinHierarchyColumn && "border-separate border-spacing-0")}
          >
            <TableHeader ref={headerElementRef}>{headerRows}</TableHeader>
            <TableBody>
              {displayTree.length ? (
                displayTree.map((node) => (
                  <DataTableMultilevelRow
                    key={getNodeId(node)}
                    node={node}
                    depth={0}
                    table={table}
                    childCountByKey={childCountByKey}
                    expandedIds={expandedIds}
                    toggleExpanded={toggleExpanded}
                    compact={compact}
                    bordered={bordered}
                    indentPxPerDepth={indentPxPerDepth}
                    getNodeId={getNodeId}
                    renderHierarchyCell={renderHierarchyCell}
                    renderNodeHeader={renderNodeHeader}
                    renderNodeFooter={renderNodeFooter}
                    hierarchyColumnClassName={hierarchyColumnClassName}
                    pinHierarchyColumn={pinHierarchyColumn}
                    onCellClick={onCellClick}
                    isCellClickable={isCellClickable}
                  />
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(1, table.getVisibleLeafColumns().length)}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    {locale.noResults}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {stickyHeader && (
            <DataTableStickyHeader
              containerRef={scrollContainerRef}
              tableRef={tableElementRef}
              headerRef={headerElementRef}
              style={
                { "--dt-accent": resolveAccentColor(accentColor) } as React.CSSProperties
              }
              zIndex={isFullscreen ? 61 : 30}
              offsetTop={stickyHeaderOffset}
              sortable={stickyHeaderSortable}
              surfaceClassName={isFullscreen ? "bg-background" : "bg-card"}
            >
              {headerRows}
            </DataTableStickyHeader>
          )}
        </div>
      </div>
    </DataTableLocaleContext.Provider>
  );

  if (isFullscreen) {
    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-50 flex flex-col bg-background p-4 animate-in fade-in-0 zoom-in-95 duration-200 sm:p-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">{tableContent}</div>
      </div>,
      document.body,
    );
  }

  return tableContent;
}
