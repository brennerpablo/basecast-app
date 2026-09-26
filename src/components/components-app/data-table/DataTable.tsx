"use client";

import {
  ColumnDef,
  type ColumnFiltersState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type Row,
  type SortingState,
  type Updater,
  useReactTable,
  type VisibilityState} from "@tanstack/react-table";
import * as React from "react";
import ReactDOM from "react-dom";

// The components-app Checkbox — upstream's DataTable imports this same
// component as `@/components/ui/checkbox`, a specifier that resolves to the
// shadcn primitive here. Import it by its synced path so the select column
// gets the real thing (notably the dash glyph for the indeterminate
// "some rows selected" header state, which the shadcn one draws as a tick).
import { Checkbox } from "@/components/components-app/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow} from "@/components/ui/table";
import { useBodyScrollLock } from "@/lib/hooks/use-body-scroll-lock";
import { cn } from "@/lib/utils";

import { buildColumnsFromMetadata, buildDefaultColumnVisibility, buildOptionLabelLookup } from "./columnBuilder";
import { type DataTableBulkAction,DataTableBulkEditor } from "./DataTableBulkEditor";
import { Filterbar } from "./DataTableFilterbar";
import { DataTableLocaleContext } from "./DataTableLocaleContext";
import { DataTableNestedSubTable } from "./DataTableNestedSubTable";
import { DataTablePagination } from "./DataTablePagination";
import { DataTableRowActions } from "./DataTableRowActions";
import { DataTableSectionHeaderRow } from "./DataTableSectionHeaderRow";
import { DataTableStickyHeader } from "./DataTableStickyHeader";
import { createExpandColumn } from "./expandColumn";
import { groupFlatRowsForExpandableTable } from "./groupFlatRows";
import { DataTableLanguage, getLocale } from "./i18n";
import {
  buildSectionedDisplayRows,
  initialCollapsedSectionIds,
} from "./sectionedRows";
import {
  ColumnMetadata,
  type DataTableExpandableGroupsConfig,
  type DataTableRenderSubTableArgs,
  type DataTableSectionsConfig,
  type DataTableSubTableHeaderActions,
  resolveAccentColor,  type ServerPaginationConfig} from "./types";

const EMPTY_TABLE_DATA: never[] = [];

// The checkbox defaults to slate when active. Bind it to the table accent
// instead (`--dt-accent`, brand emerald unless overridden) so it matches the
// selected-row indicator bar. Passing the resolved accent through the
// component's own `accentColor` prop is not an option — that prop re-wraps
// bare values in `var(--color-…)`, and `--dt-accent` is already a `var()`.
const SELECT_ACCENT_CLASS =
  "data-[state=checked]:border-[var(--dt-accent)] data-[state=checked]:bg-[var(--dt-accent)] " +
  "data-[state=indeterminate]:border-[var(--dt-accent)] data-[state=indeterminate]:bg-[var(--dt-accent)]";

function createSelectColumn<TData>(): ColumnDef<TData> {
  const helper = createColumnHelper<TData>();
  return helper.display({
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomeRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={() => table.toggleAllPageRowsSelected()}
        className={cn("translate-y-0.5", SELECT_ACCENT_CLASS)}
        aria-label="Select all"
      />
    ),
    // Fork fix (not upstream): the row itself is click-to-select, so a click
    // landing on the checkbox would toggle twice and cancel out. Stop it here
    // and let `onCheckedChange` be the single source of the toggle.
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()} className="w-fit">
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={() => row.toggleSelected()}
          className={cn("translate-y-0.5", SELECT_ACCENT_CLASS)}
          aria-label="Select row"
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
    meta: { displayName: "Select" }});
}

type RowActionCallbacks<TData> = {
  onAdd?: (row: TData) => void;
  onEdit?: (row: TData) => void;
  onDelete?: (row: TData) => void;
};

function createActionsColumn<TData>(callbacks: RowActionCallbacks<TData>): ColumnDef<TData> {
  const helper = createColumnHelper<TData>();
  return helper.display({
    id: "edit",
    header: "Edit",
    enableSorting: false,
    enableHiding: false,
    meta: { className: "text-right", displayName: "Edit" },
    cell: ({ row }) => (
      <DataTableRowActions
        row={row}
        onAdd={callbacks.onAdd}
        onEdit={callbacks.onEdit}
        onDelete={callbacks.onDelete}
      />
    )});
}

type BulkActionCallbacks<TData> = {
  onEdit?: (rows: TData[]) => void;
  onDelete?: (rows: TData[]) => void;
  /**
   * Ações em massa fora do par Editar/Excluir — cada uma com o seu rótulo e
   * atalho. Ver `DataTableBulkAction`: os dois botões embutidos têm rótulo
   * vindo do `locale` e não se renomeiam, então reaproveitar `onEdit` para
   * outra coisa poria "Editar" num botão que não edita.
   */
  actions?: DataTableBulkAction<TData>[];
};

interface DataTableProps<TData> {
  data: TData[];
  columnsMetadata?: readonly ColumnMetadata<TData>[];
  persistColumnOrder?: boolean;
  tableName?: string;
  enableRowSelection?: boolean;
  enableRowActions?: boolean;
  enablePagination?: boolean;
  pageSize?: number;
  enablePageSizeSelect?: boolean;
  paginationDisplayTop?: boolean;
  language?: DataTableLanguage;
  enableTextSelection?: boolean;
  bordered?: boolean;
  tableStyle?: "default" | "ghost";
  accentColor?: string;
  enableFullscreen?: boolean;
  enableDownload?: boolean;
  enableColumnOptions?: boolean;
  toolbarIconsOnly?: boolean;
  /** Conteúdo extra renderizado junto dos botões da toolbar. */
  toolbarExtras?: React.ReactNode;
  /** Filtros que não são de coluna, no começo da fila de filtros (ver `Filterbar`). */
  filterExtras?: React.ReactNode;
  compact?: boolean;
  fetching?: boolean;
  onRowAction?: RowActionCallbacks<TData>;
  onBulkAction?: BulkActionCallbacks<TData>;
  /** Ordenação inicial (controlada). Ex.: `[{ id: "data_constituicao", desc: true }]`. */
  initialSorting?: SortingState;
  /**
   * Filtros aplicados na primeira renderização, com a UI do filtro já marcada —
   * ex.: `[{ id: "isActive", value: ["true"] }]` para uma listagem que abre só
   * com os registos activos. Estado *inicial*, não controlado: o utilizador
   * continua a poder mexer nele, e "Limpar filtros" limpa mesmo (não repõe o
   * default). Ignorado em `serverPagination`, onde os filtros são controlados
   * pelo pai.
   */
  initialColumnFilters?: ColumnFiltersState;
  /** Agrupa linhas planas (ex.: vários registos por CNPJ); filtros aplicam-se ao plano antes de agrupar. */
  expandableGroups?: DataTableExpandableGroupsConfig<TData>;
  /** Grupos já abertos na primeira renderização (ex.: linha apontada por deep link). */
  initialExpandedGroupIds?: readonly string[];
  /** Seções colapsáveis (opt-in). Incompatível com `expandableGroups` e `serverPagination`. */
  matrixSections?: DataTableSectionsConfig<TData>;
  /** Colunas da sub-tabela (histórico). Ignorado se `renderSubTable` estiver definido. */
  subTableColumnsMetadata?: readonly ColumnMetadata<TData>[];
  subTableTitle?: string;
  /** À direita do título da sub-tabela (ex.: botão +). */
  subTableHeaderActions?: DataTableSubTableHeaderActions<TData>;
  /** Substitui a sub-tabela default (ex.: outra query). */
  renderSubTable?: (args: DataTableRenderSubTableArgs<TData>) => React.ReactNode;
  /**
   * Opt-in server-pagination mode. When provided, tanstack-table runs in
   * controlled/manual mode for pagination + sorting + filtering, per-column
   * filter UI is hidden (filters live in an external form), and `data` is
   * expected to contain only the rows for the current page. See
   * `useServerPaginatedQuery` for the typical owner of this state.
   */
  serverPagination?: ServerPaginationConfig;
  /**
   * Floats a copy of the header at the top of the viewport once the real one
   * scrolls out of view, so long tables keep their column labels. Off by
   * default. See `DataTableStickyHeader` for why this is a clone and not
   * `position: sticky`.
   */
  stickyHeader?: boolean;
  /** Gap in px between the top of the scroll viewport and the floating header. Default 16. */
  stickyHeaderOffset?: number;
  /**
   * Whether the floating header can sort. Default `true`. Set `false` to make it
   * labels-only — the sort arrows still reflect the current sort, they just stop
   * responding to clicks.
   */
  stickyHeaderSortable?: boolean;
  /**
   * Stable row identity for selection. Without it tanstack keys `rowSelection`
   * by row index, which silently re-targets a different record once `data`
   * changes — a real hazard in `serverPagination` mode, where page 2 reuses
   * indices 0..n. Ignored when `expandableGroups` is set (that mode derives
   * ids from the group key).
   */
  getRowId?: (row: TData) => string;
}

export function DataTable<TData>({
  data,
  columnsMetadata,
  persistColumnOrder = false,
  tableName,
  enableRowSelection = false,
  enableRowActions = false,
  enablePagination = true,
  pageSize = 25,
  enablePageSizeSelect = true,
  paginationDisplayTop = false,
  language = "en",
  enableTextSelection = true,
  bordered = false,
  tableStyle = "default",
  accentColor,
  enableFullscreen = false,
  enableDownload = true,
  enableColumnOptions = true,
  toolbarIconsOnly = false,
  toolbarExtras,
  filterExtras,
  compact = false,
  fetching = false,
  onRowAction,
  onBulkAction,
  initialSorting,
  initialColumnFilters,
  expandableGroups,
  initialExpandedGroupIds,
  subTableColumnsMetadata,
  subTableTitle,
  subTableHeaderActions,
  renderSubTable,
  serverPagination,
  matrixSections,
  stickyHeader = false,
  stickyHeaderOffset,
  stickyHeaderSortable = true,
  getRowId}: DataTableProps<TData>) {
  const serverMode = Boolean(serverPagination);
  const expandMode = Boolean(expandableGroups);
  const sectionMode = Boolean(matrixSections);
  if (process.env.NODE_ENV !== "production" && sectionMode && expandMode) {
    console.warn("[DataTable] matrixSections is incompatible with expandableGroups");
  }
  if (process.env.NODE_ENV !== "production" && sectionMode && serverMode) {
    console.warn("[DataTable] matrixSections is incompatible with serverPagination");
  }
  const isGhost = tableStyle === "ghost";
  const locale = getLocale(language);
  const [rowSelection, setRowSelection] = React.useState({});
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const toggleFullscreen = React.useCallback(() => setIsFullscreen((v) => !v), []);

  // Em tela cheia a tabela sai do fluxo (só o portal renderiza), mas o RESTO da
  // página continua lá: onde houver conteúdo alto fora da tabela, a barra de
  // rolagem da página sobrevive atrás do overlay e rolar não muda nada.
  useBodyScrollLock(isFullscreen);

  React.useEffect(() => {
    if (!isFullscreen) return;
    // Capture phase so Escape exits fullscreen before a parent Dialog dismisses.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      setIsFullscreen(false);
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isFullscreen]);

  const stableData = data ?? EMPTY_TABLE_DATA;

  // Stabilize onRowAction: inline object literals get a new reference on every
  // parent render, which would cause allColumns to rebuild even when nothing
  // meaningful changed. Use a ref to always call the latest callbacks without
  // including them in the memo dependency array.
  const onRowActionRef = React.useRef(onRowAction);
  React.useEffect(() => { onRowActionRef.current = onRowAction; });
  const stableOnRowAction = React.useMemo(
    () => ({
      onAdd: onRowAction?.onAdd ? (row: TData) => onRowActionRef.current?.onAdd?.(row) : undefined,
      onEdit: onRowAction?.onEdit ? (row: TData) => onRowActionRef.current?.onEdit?.(row) : undefined,
      onDelete: onRowAction?.onDelete ? (row: TData) => onRowActionRef.current?.onDelete?.(row) : undefined}),
    // Re-create only when the presence of a callback changes, not its identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!onRowAction?.onAdd, !!onRowAction?.onEdit, !!onRowAction?.onDelete],
  );

  const enrichedMetadata = React.useMemo(() => {
    if (!columnsMetadata?.length) return columnsMetadata;
    return columnsMetadata.map((col) => {
      if (!col.inferOptions) return col;
      const labelFor = buildOptionLabelLookup(col);
      const seen = new Set<string>();
      const options: { value: string; label: string }[] = [];
      for (const row of stableData) {
        const raw = (row as Record<string, unknown>)[col.columnId];
        const values = Array.isArray(raw)
          ? raw.map((item) => String(item))
          : [raw == null ? "" : String(raw)];
        for (const val of values) {
          if (val === "") continue;
          if (!seen.has(val)) {
            seen.add(val);
            options.push({ value: val, label: labelFor(val) });
          }
        }
      }
      options.sort((a, b) => a.label.localeCompare(b.label));
      return { ...col, options };
    });
  }, [columnsMetadata, stableData]);

  const builtDataColumns = React.useMemo(() => {
    return enrichedMetadata?.length ? buildColumnsFromMetadata(enrichedMetadata) : [];
  }, [enrichedMetadata]);

  // Semeado com `initialColumnFilters`, e não vazio: no modo expand os filtros
  // correm sobre a tabela plana, e começar sem eles fazia a tabela abrir SEM o
  // filtro inicial que a chamadora declarou — a de fundos abre filtrada por
  // activos. Medido em 23/09/2026: nenhuma das seis tabelas com
  // `expandableGroups` passa `initialColumnFilters`, logo a mudança é inerte
  // para todas elas.
  const [expandColumnFilters, setExpandColumnFilters] = React.useState<ColumnFiltersState>(
    () => initialColumnFilters ?? [],
  );
  // `initialExpandedGroupIds` serve quem chega por link com o grupo já aberto
  // (ex.: `/funds?fundo=<id>`, para onde a antiga página de cotas redirecciona).
  // É estado INICIAL: abrir e fechar depois é do utilizador, e uma mudança de
  // prop não volta a abrir o que ele fechou.
  const [expandedGroupIds, setExpandedGroupIds] = React.useState<Set<string>>(
    () => new Set(initialExpandedGroupIds ?? []),
  );

  const toggleExpandedGroup = React.useCallback((id: string) => {
    setExpandedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
    hasFiltersOnly || enableColumnOptions || Object.keys(defaultColumnVisibility).length > 0;

  const [userColumnVisibility, setUserColumnVisibility] = React.useState<VisibilityState>({});

  const columnVisibilityForTable = React.useMemo(() => {
    if (!needsColumnVisibilityControl) return undefined;
    const merged: VisibilityState = { ...defaultColumnVisibility, ...userColumnVisibility };
    for (const id of filterOnlyColumnIds) {
      merged[id] = false;
    }
    return merged;
  }, [
    defaultColumnVisibility,
    userColumnVisibility,
    filterOnlyColumnIds,
    needsColumnVisibilityControl,
  ]);

  const handleColumnVisibilityChange = React.useCallback(
    (updater: Updater<VisibilityState>) => {
      setUserColumnVisibility((prev) => {
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
    [defaultColumnVisibility, filterOnlyColumnIds, setUserColumnVisibility],
  );

  const flatTable = useReactTable({
    data: expandMode ? stableData : [],
    columns: expandMode ? builtDataColumns : [],
    state: {
      ...(expandMode
        ? {
            columnFilters: expandColumnFilters,
            ...(columnVisibilityForTable != null
              ? { columnVisibility: columnVisibilityForTable }
              : {})}
        : {})},
    onColumnFiltersChange: expandMode ? setExpandColumnFilters : undefined,
    getCoreRowModel: getCoreRowModel(),
    ...(expandMode ? { getFilteredRowModel: getFilteredRowModel() } : {})});

  const filteredFlat = React.useMemo(() => {
    if (!expandMode) return stableData;
    return flatTable.getFilteredRowModel().rows.map((r) => r.original);
    // expandColumnFilters is the re-compute trigger — flatTable is a stable
    // ref, but its filtered rows shift when this state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandMode, flatTable, stableData, expandColumnFilters]);

  const { parentRows, childrenByGroupId } = React.useMemo(() => {
    if (!expandMode || !expandableGroups) {
      return { parentRows: stableData, childrenByGroupId: new Map<string, TData[]>() };
    }
    return groupFlatRowsForExpandableTable(filteredFlat, expandableGroups);
  }, [expandMode, expandableGroups, filteredFlat, stableData]);

  const childCountFn = React.useCallback(
    (row: TData) => {
      if (!expandMode || !expandableGroups) return 0;
      const gid = expandableGroups.getGroupId(row);
      return childrenByGroupId.get(gid)?.length ?? 0;
    },
    [expandMode, expandableGroups, childrenByGroupId],
  );

  const subTableBuiltColumns = React.useMemo(() => {
    return subTableColumnsMetadata?.length
      ? buildColumnsFromMetadata(subTableColumnsMetadata)
      : [];
  }, [subTableColumnsMetadata]);

  const allColumns = React.useMemo(() => {
    const expandCol =
      expandMode && expandableGroups
        ? [
            createExpandColumn<TData>({
              expandedIds: expandedGroupIds,
              toggleExpanded: toggleExpandedGroup,
              getRowId: expandableGroups.getGroupId,
              childCount: childCountFn,
              hasCustomSubTable: Boolean(renderSubTable || subTableHeaderActions)}),
          ]
        : [];
    const selectCol = enableRowSelection ? [createSelectColumn<TData>()] : [];
    const actionsCol = enableRowActions ? [createActionsColumn<TData>(stableOnRowAction)] : [];
    if (expandMode) {
      return [...expandCol, ...selectCol, ...builtDataColumns, ...actionsCol];
    }
    return [...selectCol, ...builtDataColumns, ...actionsCol];
  }, [
    expandMode,
    expandableGroups,
    expandedGroupIds,
    toggleExpandedGroup,
    childCountFn,
    renderSubTable,
    subTableHeaderActions,
    enableRowSelection,
    enableRowActions,
    builtDataColumns,
    stableOnRowAction,
  ]);

  const [localSorting, setLocalSorting] = React.useState<SortingState>(
    () => initialSorting ?? [],
  );
  const sorting = serverMode ? serverPagination!.sorting : localSorting;
  // In server mode, route sort changes through the parent setter AND auto-reset
  // pageIndex to 0 — header sorts on page N would otherwise show "no results".
  const handleSortingChange = React.useCallback(
    (updater: Updater<SortingState>) => {
      if (serverMode && serverPagination) {
        serverPagination.onSortingChange(updater);
        serverPagination.onPaginationChange((prev) => ({ ...prev, pageIndex: 0 }));
      } else {
        setLocalSorting(updater);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serverMode, serverPagination?.onSortingChange, serverPagination?.onPaginationChange],
  );

  // Server-mode column filters are opt-in: when the parent passes
  // `columnFilters` + `onColumnFiltersChange` via `serverPagination`, the
  // filter bar is shown and changes flow up to the parent (same shape as
  // sort: reset pageIndex to 0 on every change).
  const columnFiltersControlled = serverMode && Boolean(serverPagination?.onColumnFiltersChange);
  // Outside server mode the filters are controlled here as well. The
  // `initialState.columnFilters` stays seeded: it is what
  // `resetColumnFilters()` with no argument restores.
  const [localColumnFilters, setLocalColumnFilters] = React.useState<ColumnFiltersState>(
    () => initialColumnFilters ?? [],
  );
  const handleColumnFiltersChange = React.useCallback(
    (updater: Updater<ColumnFiltersState>) => {
      if (columnFiltersControlled && serverPagination?.onColumnFiltersChange) {
        serverPagination.onColumnFiltersChange(updater);
        serverPagination.onPaginationChange((prev) => ({ ...prev, pageIndex: 0 }));
      } else if (!serverMode) {
        setLocalColumnFilters(updater);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [columnFiltersControlled, serverMode, setLocalColumnFilters, serverPagination?.onColumnFiltersChange, serverPagination?.onPaginationChange],
  );

  const tableInitialState = React.useMemo(() => {
    // In server mode, pagination AND filters are controlled from the parent —
    // nothing belongs in initial state.
    if (serverMode) return {};
    return {
      ...(enablePagination ? { pagination: { pageIndex: 0, pageSize } } : {}),
      ...(initialColumnFilters ? { columnFilters: initialColumnFilters } : {})};
  }, [enablePagination, initialColumnFilters, pageSize, serverMode]);

  const tableData = expandMode ? parentRows : stableData;

  const table = useReactTable({
    data: tableData,
    columns: allColumns,
    getRowId:
      expandMode && expandableGroups
        ? (row) => expandableGroups.getGroupId(row as TData)
        : getRowId
          ? (row) => getRowId(row as TData)
          : undefined,
    state: {
      rowSelection,
      ...(columnVisibilityForTable != null
        ? { columnVisibility: columnVisibilityForTable }
        : {}),
      sorting,
      ...(columnFiltersControlled
        ? { columnFilters: serverPagination!.columnFilters ?? [] }
        : !serverMode
          ? { columnFilters: localColumnFilters }
          : {}),
      ...(serverMode ? { pagination: serverPagination!.pagination } : {})},
    initialState: tableInitialState,
    ...(needsColumnVisibilityControl
      ? { onColumnVisibilityChange: handleColumnVisibilityChange }
      : {}),
    onSortingChange: handleSortingChange,
    ...(columnFiltersControlled || !serverMode
      ? { onColumnFiltersChange: handleColumnFiltersChange }
      : {}),
    ...(serverMode ? { onPaginationChange: serverPagination!.onPaginationChange } : {}),
    ...(enablePagination && !serverMode && {
      getPaginationRowModel: getPaginationRowModel()}),
    ...(serverMode && {
      manualPagination: true,
      manualSorting: true,
      manualFiltering: true,
      rowCount: serverPagination!.totalRows,
      pageCount: Math.max(1, Math.ceil(serverPagination!.totalRows / Math.max(1, serverPagination!.pagination.pageSize)))}),
    enableRowSelection,
    // In server mode, skip filtered/sorted row models entirely — `data` is already paged.
    ...(!serverMode && { getFilteredRowModel: getFilteredRowModel() }),
    ...(!serverMode && { getSortedRowModel: getSortedRowModel() }),
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel()});

  const showFetchingOverlay = fetching || Boolean(serverPagination?.isFetching);

  const [collapsedSectionIds, setCollapsedSectionIds] = React.useState<Set<string>>(() =>
    matrixSections ? initialCollapsedSectionIds(matrixSections.sections) : new Set(),
  );

  const toggleSection = React.useCallback((sectionId: string) => {
    setCollapsedSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const sectionedDisplayRows = React.useMemo(() => {
    if (!sectionMode || !matrixSections) return null;
    return buildSectionedDisplayRows(
      table.getRowModel().rows,
      matrixSections,
      collapsedSectionIds,
    );
  }, [sectionMode, matrixSections, collapsedSectionIds, table]);

  const visibleColumnCount = Math.max(1, table.getVisibleLeafColumns().length);

  // Measured by the floating header clone (`stickyHeader`).
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const tableElementRef = React.useRef<HTMLTableElement | null>(null);
  const headerElementRef = React.useRef<HTMLTableSectionElement | null>(null);
  const headerClassName = cn(isGhost && "[&_tr]:border-0!");

  // Built once and rendered in both the in-flow header and the floating clone.
  // Sharing the element identity also means the clone's own geometry updates
  // never re-render these cells.
  const headerRows = table.getHeaderGroups().map((headerGroup) => (
    <TableRow
      key={headerGroup.id}
      className={cn(
        "border-border",
        !isGhost && "bg-muted/50 hover:bg-muted/50",
        !isGhost && (bordered ? "border-b" : "border-y"),
        isGhost && "hover:bg-transparent",
      )}
    >
      {headerGroup.headers.map((header) => (
        <TableHead
          key={header.id}
          className={cn(
            compact
              ? "whitespace-nowrap py-0.5 text-sm sm:text-xs"
              : "whitespace-nowrap py-2 text-sm sm:text-xs",
            bordered && (expandMode ? "first:pl-1 last:pr-4" : "first:pl-4 last:pr-4"),
            header.column.columnDef.meta?.className,
            // `columnClassName` describes the DATA cells — `align-top` is how a
            // column with multi-line rows keeps its text at the top — but it
            // lands on the header cell too. Left alone, those labels top-align
            // while columns without it stay centred, so a header row mixes two
            // baselines (most visible against the actions column's icon).
            // Restored last so it wins the vertical-align group in twMerge.
            "align-middle",
          )}
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
        </TableHead>
      ))}
    </TableRow>
  ));

  const renderTanstackDataRow = React.useCallback(
    (row: Row<TData>) => (
      <TableRow
        key={row.id}
        onClick={
          enableRowSelection
            ? () => row.toggleSelected(!row.getIsSelected())
            : undefined
        }
        className={cn(
          "group",
          isGhost && "border-0! hover:bg-transparent",
          !enableTextSelection && "select-none",
          enableRowSelection && "cursor-pointer",
          enableRowSelection && !isGhost && "hover:bg-muted/50",
        )}
      >
        {row.getVisibleCells().map((cell, index) => (
          <TableCell
            key={cell.id}
            className={cn(
              !isGhost && "bg-background group-hover:bg-muted/30",
              !isGhost && row.getIsSelected() && "bg-muted/70",
              compact
                ? cn(
                    "relative whitespace-nowrap py-0.5 text-muted-foreground",
                    expandMode
                      ? "first:w-9 first:max-w-9 first:min-w-9 first:p-0 first:px-0"
                      : "first:w-10",
                  )
                : cn(
                    "relative whitespace-nowrap py-2 text-muted-foreground",
                    expandMode
                      ? "first:w-9 first:max-w-9 first:min-w-9 first:px-0 first:py-1"
                      : "first:w-10",
                  ),
              bordered && (expandMode ? "first:pl-1 last:pr-4" : "first:pl-4 last:pr-4"),
              cell.column.columnDef.meta?.className,
            )}
          >
            {index === 0 && row.getIsSelected() && enableRowSelection ? (
              <div
                className="absolute inset-y-0 left-0 w-0.5"
                style={{ backgroundColor: "var(--dt-accent)" }}
              />
            ) : null}
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        ))}
      </TableRow>
    ),
    [
      bordered,
      compact,
      enableRowSelection,
      enableTextSelection,
      expandMode,
      isGhost,
    ],
  );

  const tableContent = (
    <DataTableLocaleContext.Provider value={locale}>
      <div
        className={cn("space-y-3 transition-opacity duration-300", showFetchingOverlay && "opacity-50 pointer-events-none")}
        style={
          { "--dt-accent": resolveAccentColor(accentColor) } as React.CSSProperties
        }
      >
        <Filterbar
          table={table}
          filterSourceTable={expandMode ? flatTable : undefined}
          columnsMetadata={enrichedMetadata}
          persistColumnOrder={persistColumnOrder}
          tableName={tableName}
          accentColor={accentColor}
          isFullscreen={isFullscreen}
          onToggleFullscreen={enableFullscreen ? toggleFullscreen : undefined}
          enableDownload={enableDownload}
          enableColumnOptions={enableColumnOptions}
          toolbarIconsOnly={toolbarIconsOnly}
          toolbarExtras={toolbarExtras}
          filterExtras={filterExtras}
          hideColumnFilters={serverMode && !columnFiltersControlled}
          onServerDownload={serverPagination?.onDownload}
        />
        {enablePagination && paginationDisplayTop && (
          <DataTablePagination table={table} enablePageSizeSelect={enablePageSizeSelect} enableRowActions={enableRowActions} />
        )}
        <div
          ref={scrollContainerRef}
          className={cn(
            "relative overflow-hidden overflow-x-auto",
            bordered && "rounded-md border border-border",
          )}
        >
          <Table ref={tableElementRef}>
            <TableHeader ref={headerElementRef} className={headerClassName}>
              {headerRows}
            </TableHeader>
            <TableBody>
              {sectionMode && matrixSections && sectionedDisplayRows ? (
                sectionedDisplayRows.length ? (
                  sectionedDisplayRows.map((item) => {
                    if (item.kind === "section") {
                      return (
                        <DataTableSectionHeaderRow
                          key={`section-${item.section.id}`}
                          section={item.section}
                          collapsed={collapsedSectionIds.has(item.section.id)}
                          colSpan={visibleColumnCount}
                          compact={compact}
                          isGhost={isGhost}
                          onToggle={() => toggleSection(item.section.id)}
                          renderSectionHeader={matrixSections.renderSectionHeader}
                          rowCount={item.rowCount}
                        />
                      );
                    }
                    return renderTanstackDataRow(item.row);
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={visibleColumnCount} className="h-24 text-center">
                      {locale.noResults}
                    </TableCell>
                  </TableRow>
                )
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row) => {
                  const gid =
                    expandMode && expandableGroups
                      ? expandableGroups.getGroupId(row.original)
                      : row.id;
                  const children =
                    expandMode && expandableGroups
                      ? (childrenByGroupId.get(gid) ?? [])
                      : [];
                  const isOpen = expandMode && expandedGroupIds.has(gid);
                  const showSubRow =
                    expandMode &&
                    expandableGroups &&
                    isOpen &&
                    (renderSubTable != null ||
                      subTableHeaderActions != null ||
                      children.length > 0);
                  const parentColSpan = Math.max(1, table.getVisibleLeafColumns().length);

                  const rowEl = (
                    <TableRow
                      key={row.id}
                      onClick={
                        enableRowSelection
                          ? () => row.toggleSelected(!row.getIsSelected())
                          : undefined
                      }
                      className={cn(
                        "group",
                        isGhost && "border-0! hover:bg-transparent",
                        !enableTextSelection && "select-none",
                        enableRowSelection && "cursor-pointer",
                        enableRowSelection && !isGhost && "hover:bg-muted/50",
                      )}
                    >
                      {row.getVisibleCells().map((cell, index) => (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            !isGhost && "bg-background group-hover:bg-muted/30",
                            !isGhost && row.getIsSelected() && "bg-muted/70",
                            compact
                              ? cn(
                                  // `<Table>` is text-sm by default; compact rows
                                  // drop to 12px so every table reads the same
                                  // without each column wrapping cells in text-xs.
                                  "relative whitespace-nowrap py-0.5 text-xs text-muted-foreground",
                                  expandMode
                                    ? "first:w-9 first:max-w-9 first:min-w-9 first:p-0 first:px-0"
                                    : "first:w-10",
                                )
                              : cn(
                                  "relative whitespace-nowrap py-2 text-muted-foreground",
                                  expandMode
                                    ? "first:w-9 first:max-w-9 first:min-w-9 first:px-0 first:py-1"
                                    : "first:w-10",
                                ),
                            bordered && (expandMode ? "first:pl-1 last:pr-4" : "first:pl-4 last:pr-4"),
                            cell.column.columnDef.meta?.className,
                          )}
                        >
                          {index === 0 &&
                            row.getIsSelected() &&
                            enableRowSelection && (
                              <div
                                className="absolute inset-y-0 left-0 w-0.5"
                                style={{ backgroundColor: "var(--dt-accent)" }}
                              />
                            )}
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  );

                  if (!showSubRow) {
                    return <React.Fragment key={row.id}>{rowEl}</React.Fragment>;
                  }

                  return (
                    <React.Fragment key={row.id}>
                      {rowEl}
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell
                          colSpan={parentColSpan}
                          className="border-border border-b p-0 align-top"
                        >
                          <div className="bg-muted/90 p-4 pl-12">
                            {subTableTitle || subTableHeaderActions ? (
                              <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
                                {subTableTitle ? (
                                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">
                                    {subTableTitle}
                                  </p>
                                ) : (
                                  <span className="sr-only">Sub-tabela</span>
                                )}
                                {subTableHeaderActions ? (
                                  <div className="shrink-0">
                                    {subTableHeaderActions({
                                      primary: row.original,
                                      children,
                                      groupId: gid})}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                            {renderSubTable ? (
                              renderSubTable({
                                primary: row.original,
                                children,
                                groupId: gid})
                            ) : subTableBuiltColumns.length > 0 && children.length > 0 ? (
                              <DataTableNestedSubTable
                                data={children}
                                columns={subTableBuiltColumns}
                                compact={compact}
                                isGhost={isGhost}
                              />
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumnCount}
                    className="h-24 text-center"
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
              headerClassName={headerClassName}
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
          {enableRowSelection && (
            <DataTableBulkEditor
              table={table}
              rowSelection={rowSelection}
              onEdit={onBulkAction?.onEdit}
              onDelete={onBulkAction?.onDelete}
              actions={onBulkAction?.actions}
            />
          )}
        </div>
        {enablePagination && !paginationDisplayTop && (
          <DataTablePagination table={table} enablePageSizeSelect={enablePageSizeSelect} enableRowActions={enableRowActions} />
        )}
      </div>
    </DataTableLocaleContext.Provider>
  );

  if (isFullscreen) {
    return ReactDOM.createPortal(
      <div
        data-datatable-fullscreen=""
        className="fixed inset-0 z-60 flex flex-col bg-background p-4 animate-in fade-in-0 zoom-in-95 duration-200 sm:p-6"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-auto">
          {tableContent}
        </div>
      </div>,
      document.body,
    );
  }

  return tableContent;
}
