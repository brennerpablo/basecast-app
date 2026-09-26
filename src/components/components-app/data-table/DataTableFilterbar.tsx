"use client";

import { Column, Table } from "@tanstack/react-table";
import {
  Download,
  Maximize2,
  Minimize2
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useDebouncedCallback } from "use-debounce";

import { FilterClearButton } from "@/components/components-app/url-filters";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { exportTableToCSV } from "@/lib/exportTableToCSV";
import { exportTableToXLSX } from "@/lib/exportTableToXLSX";

import { DataTableFilter } from "./DataTableFilter";
import { useDataTableLocale } from "./DataTableLocaleContext";
import { ViewOptions } from "./DataTableViewOptions";
import { ColumnMetadata } from "./types";

function TextFilterInput<TData>({
  column,
  title,
  extraTitles = []}: {
  column: Column<TData, unknown>;
  title: string;
  extraTitles?: string[];
}) {
  const locale = useDataTableLocale();
  const [value, setValue] = useState("");

  const debouncedSet = useDebouncedCallback((v: string) => {
    column.setFilterValue(v || undefined);
  }, 300);

  return (
    <Input
      type="search"
      placeholder={locale.searchBy([title, ...extraTitles].join(", "))}
      value={value}
      onChange={(e) => {
        setValue(e.target.value);
        debouncedSet(e.target.value);
      }}
      className="h-8 w-full text-xs sm:max-w-62.5"
    />
  );
}

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  /** Quando definido (ex.: modo expandable groups), filtros aplicam-se a esta tabela (dados planos); export/colunas usam `table`. */
  filterSourceTable?: Table<TData>;
  columnsMetadata?: readonly ColumnMetadata<TData>[];
  persistColumnOrder?: boolean;
  columnOrderFollowsData?: boolean;
  tableName?: string;
  accentColor?: string;
  isFullscreen: boolean;
  onToggleFullscreen?: () => void;
  enableDownload?: boolean;
  enableColumnOptions?: boolean;
  toolbarIconsOnly?: boolean;
  /** Server-pagination mode: filters move to an external form, so suppress all per-column filter UI in the bar. */
  hideColumnFilters?: boolean;
  /** Server-pagination download override. When set, the toolbar shows a single icon button wired to this callback instead of the CSV/XLSX dropdown (which would otherwise only see the current page). */
  onServerDownload?: () => void | Promise<void>;
  /** Export server-side com dropdown CSV/XLSX (todos os registros do filtro). */
  onServerExport?: (format: "csv" | "xlsx") => void | Promise<void>;
  /** Conteúdo extra na toolbar (ex.: seletor de níveis hierárquicos). */
  toolbarExtras?: ReactNode;
  /**
   * Conteúdo extra na *abertura* da toolbar, antes do download. É onde ficam os
   * controles que agem sobre as linhas (expandir/recolher tudo) — os demais
   * botões agem sobre a tabela inteira (exportar, colunas, tela cheia), e
   * misturar as duas famílias no mesmo bloco deixava o par de chevrons perdido
   * no meio de ícones sem relação com ele.
   */
  toolbarExtrasLeading?: ReactNode;
  /**
   * Filtros que não são de coluna, no começo da fila de filtros (ex.: o período
   * que vai para a consulta do servidor). Use `DataTableStandaloneFilter` /
   * `DataTableToggleFilter` para ter o mesmo gatilho dos filtros de coluna.
   * App-only (fork).
   */
  filterExtras?: ReactNode;
}

export function Filterbar<TData>({
  table,
  filterSourceTable,
  columnsMetadata,
  persistColumnOrder = false,
  columnOrderFollowsData = false,
  tableName,
  accentColor,
  isFullscreen,
  onToggleFullscreen,
  enableDownload = true,
  enableColumnOptions = true,
  toolbarIconsOnly = false,
  hideColumnFilters = false,
  onServerDownload,
  onServerExport,
  toolbarExtras,
  toolbarExtrasLeading,
  filterExtras,
}: DataTableToolbarProps<TData>) {
  const locale = useDataTableLocale();
  const filterTable = filterSourceTable ?? table;
  const isFiltered = filterTable.getState().columnFilters.length > 0;
  const [clearKey, setClearKey] = useState(0);

  const handleClearFilters = () => {
    // `true` = reset to a blank state. Without it tanstack resets to
    // `initialState.columnFilters`, so a table with `initialColumnFilters`
    // would re-apply its default here — the button says "limpar", not
    // "repor".
    filterTable.resetColumnFilters(true);
    setClearKey((k) => k + 1);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-x-6">
      <div className="flex w-full flex-col gap-2 sm:w-fit sm:flex-row sm:items-center">
        {filterExtras}
        {!hideColumnFilters && columnsMetadata?.map((col) => {
          if (!col.filters) return null;
          const column = filterTable.getColumn(col.columnId);
          if (!column) return null;
          if (!col.filterOnly && !column.getIsVisible()) return null;

          return (
            <div key={col.columnId} className="contents">
              {col.filters.select && (
                <DataTableFilter
                  column={column}
                  title={col.title}
                  options={col.options}
                  type="select"
                  accentColor={accentColor}
                />
              )}
              {col.filters.checkbox && (
                <DataTableFilter
                  column={column}
                  title={col.title}
                  options={col.options}
                  type="checkbox"
                  accentColor={accentColor}
                />
              )}
              {(col.filters.checkboxSearch || col.filters.checkboxArray) && (
                <DataTableFilter
                  column={column}
                  title={col.title}
                  options={col.options}
                  type="checkboxSearch"
                  multiple={
                    typeof col.filters.checkboxSearch === "object"
                      ? (col.filters.checkboxSearch.multiple ?? true)
                      : true
                  }
                  accentColor={accentColor}
                />
              )}
              {col.filters.number && (
                <DataTableFilter
                  column={column}
                  title={col.title}
                  type="number"
                  formatter={
                    col.filterValueFormatter
                      ? (value) => col.filterValueFormatter!(Number(value))
                      : undefined
                  }
                  accentColor={accentColor}
                />
              )}
              {col.filters.percentage && (
                <DataTableFilter
                  column={column}
                  title={col.title}
                  type="percentage"
                  accentColor={accentColor}
                />
              )}
              {col.filters.date && (
                <DataTableFilter
                  column={column}
                  title={col.title}
                  type="date"
                  accentColor={accentColor}
                  datePresets={col.datePresets}
                />
              )}
              {col.filters.dateSingle && (
                <DataTableFilter
                  column={column}
                  title={col.title}
                  options={col.options}
                  type="dateSingle"
                  accentColor={accentColor}
                />
              )}
              {col.filters.text && (
                <TextFilterInput
                  key={`${col.columnId}-${clearKey}`}
                  column={column}
                  title={col.title}
                  extraTitles={col.filters.textColumns?.map(
                    (id) => columnsMetadata?.find((m) => m.columnId === id)?.title ?? id
                  )}
                />
              )}
            </div>
          );
        })}
        {!hideColumnFilters && isFiltered && (
          <FilterClearButton
            onClick={handleClearFilters}
            label={locale.clearFilters}
          />
        )}
      </div>
      <div className="flex items-center gap-2">
        {toolbarExtrasLeading}
        {enableDownload && onServerDownload && !onServerExport && (
          <Button
            variant="outline"
            className="hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
            size="sm"
            aria-label={locale.export}
            onClick={() => void onServerDownload()}
          >
            <Download className="size-4 shrink-0" aria-hidden="true" />
            {!toolbarIconsOnly && locale.export}
          </Button>
        )}
        {enableDownload && onServerExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
                size="sm"
                aria-label={locale.export}
              >
                <Download className="size-4 shrink-0" aria-hidden="true" />
                {!toolbarIconsOnly && locale.export}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => void onServerExport("csv")}>
                {locale.exportCsv}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => void onServerExport("xlsx")}>
                {locale.exportXlsx}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {enableDownload && !onServerDownload && !onServerExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
                size="sm"
                aria-label={locale.export}
              >
                <Download className="size-4 shrink-0" aria-hidden="true" />
                {!toolbarIconsOnly && locale.export}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  const filename = tableName ?? "export";
                  void exportTableToCSV(table, filename);
                }}
              >
                {locale.exportCsv}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const filename = tableName ?? "export";
                  void exportTableToXLSX(table, filename);
                }}
              >
                {locale.exportXlsx}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {toolbarExtras}
        {enableColumnOptions && (
          <ViewOptions table={table} persistColumnOrder={persistColumnOrder} columnOrderFollowsData={columnOrderFollowsData} iconsOnly={toolbarIconsOnly} />
        )}
        {onToggleFullscreen && (
          <Button
            variant="outline"
            size="sm"
            className="hidden gap-x-2 px-2 py-1.5 text-sm sm:text-xs lg:flex"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? locale.exitFullscreen : locale.fullscreen}
          >
            {isFullscreen ? (
              <Minimize2 className="size-4 shrink-0" aria-hidden="true" />
            ) : (
              <Maximize2 className="size-4 shrink-0" aria-hidden="true" />
            )}
            {!toolbarIconsOnly && (isFullscreen ? locale.exitFullscreen : locale.fullscreen)}
          </Button>
        )}
      </div>
    </div>
  );
}
