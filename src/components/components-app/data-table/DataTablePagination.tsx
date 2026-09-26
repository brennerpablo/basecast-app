import { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue} from "@/components/components-app/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useDataTableLocale } from "./DataTableLocaleContext";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200];

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  enablePageSizeSelect?: boolean;
  enableRowActions?: boolean;
}

export function DataTablePagination<TData>({
  table,
  enablePageSizeSelect = true,
  enableRowActions = true}: DataTablePaginationProps<TData>) {
  const locale = useDataTableLocale();
  const pageSize = table.getState().pagination.pageSize;

  const paginationButtons = [
    {
      Icon: ChevronsLeft,
      onClick: () => table.setPageIndex(0),
      disabled: !table.getCanPreviousPage(),
      srText: locale.firstPage,
      mobileView: "hidden sm:inline-flex"},
    {
      Icon: ChevronLeft,
      onClick: () => table.previousPage(),
      disabled: !table.getCanPreviousPage(),
      srText: locale.previousPage,
      mobileView: ""},
    {
      Icon: ChevronRight,
      onClick: () => table.nextPage(),
      disabled: !table.getCanNextPage(),
      srText: locale.nextPage,
      mobileView: ""},
    {
      Icon: ChevronsRight,
      onClick: () => table.setPageIndex(table.getPageCount() - 1),
      disabled: !table.getCanNextPage(),
      srText: locale.lastPage,
      mobileView: "hidden sm:inline-flex"},
  ];

  // `getRowCount()` returns the controlled `rowCount` option in server mode
  // and falls back to the filtered row count in client mode.
  const totalRows = table.getRowCount();
  const currentPage = table.getState().pagination.pageIndex;
  const firstRowIndex = totalRows === 0 ? 0 : currentPage * pageSize + 1;
  const lastRowIndex = Math.min(totalRows, firstRowIndex + pageSize - 1);

  return (
    <div className="flex items-center justify-between">
      {enableRowActions && (
        <div className="text-sm tabular-nums text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of {totalRows}{" "}
          {locale.rowsSelected}
        </div>
      )}
      <div className={cn("flex items-center gap-x-6 lg:gap-x-8", !enableRowActions && "ml-auto")}>
        {enablePageSizeSelect && (
          <div className="hidden items-center gap-x-2 sm:flex">
            <p className="text-sm text-muted-foreground">
              {locale.rowsPerPage}
            </p>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
                table.setPageIndex(0);
              }}
            >
              <SelectTrigger className="h-8 w-20 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <p className="hidden text-sm tabular-nums text-muted-foreground sm:block">
          {locale.showing}{" "}
          <span className="font-medium text-foreground">
            {firstRowIndex}-{lastRowIndex}
          </span>{" "}
          {locale.of}{" "}
          <span className="font-medium text-foreground">{totalRows}</span>
        </p>
        <div className="flex items-center gap-x-1.5">
          {paginationButtons.map((button, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className={cn(button.mobileView)}
              aria-label={button.srText}
              onClick={() => {
                button.onClick();
                table.resetRowSelection();
              }}
              disabled={button.disabled}
            >
              <button.Icon className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
