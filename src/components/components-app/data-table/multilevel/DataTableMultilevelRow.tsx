"use client";

import { flexRender, type Row, type Table } from "@tanstack/react-table";
import { Fragment, type ReactNode } from "react";

import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { createExpandColumn } from "../expandColumn";
import type {
  MultilevelHierarchyCellContext,
  MultilevelToggleExpandArgs,
  MultilevelTreeNode,
} from "../types";
import {
  MULTILEVEL_EXPAND_COLUMN_ID,
  MULTILEVEL_HIERARCHY_COLUMN_ID,
  type MultilevelFlatRow,
} from "./treeUtils";

type RowProps<TPayload> = {
  node: MultilevelTreeNode<TPayload>;
  depth: number;
  table: Table<MultilevelFlatRow<TPayload>>;
  childCountByKey: Map<string, number>;
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  compact: boolean;
  bordered: boolean;
  indentPxPerDepth: number;
  getNodeId: (node: MultilevelTreeNode<TPayload>) => string;
  renderHierarchyCell: (ctx: MultilevelHierarchyCellContext<TPayload>) => ReactNode;
  renderNodeHeader?: (args: MultilevelToggleExpandArgs<TPayload>) => ReactNode;
  renderNodeFooter?: (args: MultilevelToggleExpandArgs<TPayload>) => ReactNode;
  hierarchyColumnClassName?: string;
  pinHierarchyColumn?: boolean;
  onCellClick?: (node: MultilevelTreeNode<TPayload>, columnId: string) => void;
  isCellClickable?: (node: MultilevelTreeNode<TPayload>, columnId: string) => boolean;
};

function getFlatRow<TPayload>(
  table: Table<MultilevelFlatRow<TPayload>>,
  nodeKey: string,
): Row<MultilevelFlatRow<TPayload>> | undefined {
  return table.getCoreRowModel().rows.find((r) => r.original.__nodeKey === nodeKey);
}

export function DataTableMultilevelRow<TPayload>({
  node,
  depth,
  table,
  childCountByKey,
  expandedIds,
  toggleExpanded,
  compact,
  bordered,
  indentPxPerDepth,
  getNodeId,
  renderHierarchyCell,
  renderNodeHeader,
  renderNodeFooter,
  hierarchyColumnClassName,
  pinHierarchyColumn,
  onCellClick,
  isCellClickable,
}: RowProps<TPayload>) {
  const nodeId = getNodeId(node);
  const childCount = childCountByKey.get(nodeId) ?? 0;
  const hasChildren = childCount > 0;
  const open = hasChildren && expandedIds.has(nodeId);
  const indentPx = depth * indentPxPerDepth;
  const flatRow = getFlatRow(table, nodeId);

  const visibleColumns = table
    .getVisibleLeafColumns()
    .filter(
      (c) =>
        c.id !== MULTILEVEL_EXPAND_COLUMN_ID && c.id !== MULTILEVEL_HIERARCHY_COLUMN_ID,
    );

  const expandCol = table.getColumn(MULTILEVEL_EXPAND_COLUMN_ID);
  const expandCell =
    expandCol && flatRow
      ? flexRender(expandCol.columnDef.cell, flatRow.getVisibleCells().find((c) => c.column.id === MULTILEVEL_EXPAND_COLUMN_ID)!.getContext())
      : null;

  const row = (
    <TableRow
      className={cn(
        "group",
        // Base OPACA para toda linha quando há coluna congelada: as células
        // fixas usam `bg-inherit`, e sem fundo na linha elas ficariam
        // transparentes — o conteúdo que rola passaria por baixo do rótulo.
        pinHierarchyColumn && "bg-background",
        // Com a coluna congelada, a linha precisa de fundo OPACO: as células
        // fixas herdam dele, e sem opacidade total o conteúdo que rola aparece
        // por baixo. `bg-muted/25` translúcido deixava uma emenda visível na
        // fronteira do painel congelado.
        open && hasChildren && !pinHierarchyColumn && "bg-muted/25 hover:bg-muted/25",
        open && hasChildren && pinHierarchyColumn && "bg-secondary hover:bg-secondary",
        !open && hasChildren && "hover:bg-muted/40",
      )}
    >
      <TableCell
        className={cn(
          compact
            ? "w-9 max-w-9 min-w-9 py-0.5 px-0 text-center align-middle"
            : "w-9 max-w-9 min-w-9 px-0 py-1 text-center align-middle",
          bordered && "pl-1",
          // Com `border-separate` — que o sticky exige — a borda do `<tr>` não
          // é pintada. Ela passa para as células, senão as linhas somem.
          pinHierarchyColumn && "border-b border-border",
          pinHierarchyColumn &&
            cn(
              "sticky left-0 z-20",
              // Fundo EXPLÍCITO, não `inherit`: com `inherit` as células fixas
              // seguiam o hover da linha e o painel congelado piscava junto,
              // que é o oposto do que "congelado" deve parecer.
              open && hasChildren ? "bg-secondary" : "bg-background",
            ),
        )}
      >
        {expandCell}
      </TableCell>
      <TableCell
        className={cn(
          compact
            ? "py-0.5 text-xs"
            : "py-2 text-sm sm:text-xs",
          hierarchyColumnClassName ??
            cn(
              "min-w-[12rem] max-w-[24rem] whitespace-nowrap text-foreground",
            ),
          bordered && "pr-2",
          pinHierarchyColumn && "border-b border-border",
          // `left-9` = a largura do expansor (`w-9`), que fica congelado antes
          // desta. A borda direita marca a fronteira do painel congelado.
          pinHierarchyColumn &&
            cn(
              "sticky left-9 z-20 border-r border-border",
              open && hasChildren ? "bg-secondary" : "bg-background",
            ),
        )}
      >
        {renderHierarchyCell({ node, depth, hasChildren, indentPx })}
      </TableCell>
      {visibleColumns.map((column) => {
        const cell = flatRow
          ? flatRow.getVisibleCells().find((c) => c.column.id === column.id)
          : undefined;
        // Clicável só onde há o que abrir. Célula que responde ao clique e não
        // mostra nada é pior que célula inerte: ensina o usuário a desconfiar
        // do resto.
        const clicavel = Boolean(onCellClick && isCellClickable?.(node, column.id));
        return (
          <TableCell
            key={column.id}
            onClick={clicavel ? () => onCellClick?.(node, column.id) : undefined}
            className={cn(
              compact
                ? "whitespace-nowrap py-0.5 text-xs text-muted-foreground"
                : "whitespace-nowrap py-2 text-sm text-muted-foreground sm:text-xs",
              column.columnDef.meta?.className,
              bordered && "last:pr-4",
              pinHierarchyColumn && "border-b border-border",
              clicavel && "cursor-pointer hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {cell ? flexRender(column.columnDef.cell, cell.getContext()) : "—"}
          </TableCell>
        );
      })}
    </TableRow>
  );

  if (!hasChildren || !open) {
    return row;
  }

  const toggleArgs: MultilevelToggleExpandArgs<TPayload> = {
    nodeId,
    expanded: open,
    node,
    depth,
  };
  const header = renderNodeHeader?.(toggleArgs) ?? null;
  const footer = renderNodeFooter?.(toggleArgs) ?? null;

  return (
    <Fragment>
      {row}
      {header}
      {node.children?.map((child) => (
        <DataTableMultilevelRow
          key={getNodeId(child)}
          node={child}
          depth={depth + 1}
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
      ))}
      {footer}
    </Fragment>
  );
}

/** Coluna expand com contagem de filhos na árvore (não na linha plana). */
export function createMultilevelExpandColumn<TPayload>(args: {
  expandedIds: Set<string>;
  toggleExpanded: (id: string) => void;
  childCountByKey: Map<string, number>;
}): ReturnType<typeof createExpandColumn<MultilevelFlatRow<TPayload>>> {
  return createExpandColumn<MultilevelFlatRow<TPayload>>({
    expandedIds: args.expandedIds,
    toggleExpanded: args.toggleExpanded,
    getRowId: (row) => row.__nodeKey,
    childCount: (row) => args.childCountByKey.get(row.__nodeKey) ?? 0,
  });
}
