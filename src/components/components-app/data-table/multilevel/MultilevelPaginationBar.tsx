"use client";

import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/components-app/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useDataTableLocale } from "../DataTableLocaleContext";

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

export type MultilevelPaginationBarProps = {
  totalRows: number;
  pageIndex: number;
  pageSize: number;
  onPageIndexChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  isFetching?: boolean;
  className?: string;
  indentPx?: number;
};

export function MultilevelPaginationBar({
  totalRows,
  pageIndex,
  pageSize,
  onPageIndexChange,
  onPageSizeChange,
  isFetching = false,
  className,
  indentPx = 0,
}: MultilevelPaginationBarProps) {
  const locale = useDataTableLocale();
  const pageCount = Math.max(1, Math.ceil(totalRows / Math.max(1, pageSize)));
  const safePage = Math.min(pageIndex, pageCount - 1);
  const firstRowIndex = totalRows === 0 ? 0 : safePage * pageSize + 1;
  const lastRowIndex = Math.min(totalRows, firstRowIndex + pageSize - 1);

  const canPrevious = safePage > 0;
  const canNext = safePage < pageCount - 1;

  if (totalRows === 0) return null;

  return (
    <tr className={cn(isFetching && "opacity-60", className)}>
      <td colSpan={999} className="border-t border-border bg-muted/20 p-0">
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
          style={{ paddingLeft: indentPx > 0 ? indentPx + 12 : undefined }}
        >
          <div className="flex items-center gap-x-2">
            <p className="text-xs text-muted-foreground sm:text-sm">{locale.rowsPerPage}</p>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => {
                onPageSizeChange(Number(value));
                onPageIndexChange(0);
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
          <p className="text-xs tabular-nums text-muted-foreground sm:text-sm">
            {locale.showing}{" "}
            <span className="font-medium text-foreground">
              {firstRowIndex}-{lastRowIndex}
            </span>{" "}
            {locale.of}{" "}
            <span className="font-medium text-foreground">{totalRows}</span>
          </p>
          <div className="flex items-center gap-x-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              disabled={!canPrevious || isFetching}
              aria-label={locale.firstPage}
              onClick={() => onPageIndexChange(0)}
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canPrevious || isFetching}
              aria-label={locale.previousPage}
              onClick={() => onPageIndexChange(safePage - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canNext || isFetching}
              aria-label={locale.nextPage}
              onClick={() => onPageIndexChange(safePage + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              disabled={!canNext || isFetching}
              aria-label={locale.lastPage}
              onClick={() => onPageIndexChange(pageCount - 1)}
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}
