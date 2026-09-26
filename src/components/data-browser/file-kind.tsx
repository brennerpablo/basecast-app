import {
  FileArchiveIcon,
  FileIcon,
  FileJson2Icon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  type LucideIcon,
  MapIcon,
  PresentationIcon,
  TableIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

import type { FileKind } from "./api";

const KINDS: Record<FileKind, { Icon: LucideIcon; color: string; viewer: string; parser: string }> = {
  sheet: {
    Icon: FileSpreadsheetIcon,
    color: "text-emerald-700 dark:text-emerald-400",
    viewer: "Sheet grid",
    parser: "Every sheet in a positional grid, with sheet tabs.",
  },
  text: {
    Icon: FileTextIcon,
    color: "text-teal-700 dark:text-teal-400",
    viewer: "Delimited grid",
    parser: "Comma, pipe or tab separated, shown positionally.",
  },
  parquet: {
    Icon: TableIcon,
    color: "text-violet-700 dark:text-violet-400",
    viewer: "Typed grid",
    parser: "Columns with their Parquet names and types.",
  },
  json: {
    Icon: FileJson2Icon,
    color: "text-blue-700 dark:text-blue-400",
    viewer: "Tree and table",
    parser: "Arrays of records or parallel arrays become a table.",
  },
  geojson: {
    Icon: MapIcon,
    color: "text-cyan-700 dark:text-cyan-400",
    viewer: "Tree and table",
    parser: "Feature properties become rows.",
  },
  zip: {
    Icon: FileArchiveIcon,
    color: "text-amber-700 dark:text-amber-400",
    viewer: "Archive members",
    parser: "Each member opens with the viewer of its own type.",
  },
  pdf: {
    Icon: FileTextIcon,
    color: "text-red-700 dark:text-red-400",
    viewer: "PDF pages",
    parser: "Rendered by pdf.js, read in ranges.",
  },
  slides: {
    Icon: PresentationIcon,
    color: "text-orange-700 dark:text-orange-400",
    viewer: "Slide text",
    parser: "The text of every slide.",
  },
  document: {
    Icon: FileTextIcon,
    color: "text-blue-700 dark:text-blue-400",
    viewer: "Document text",
    parser: "Paragraphs grouped by heading, then the tables.",
  },
  html: {
    Icon: FileTextIcon,
    color: "text-slate-600 dark:text-slate-400",
    viewer: "Page text",
    parser: "The page's readable text.",
  },
  other: {
    Icon: FileIcon,
    color: "text-slate-500 dark:text-slate-400",
    viewer: "Download only",
    parser: "No preview for this format.",
  },
};

export function kindInfo(kind: FileKind) {
  return KINDS[kind] ?? KINDS.other;
}

export function FileKindIcon({ kind, className }: { kind: FileKind; className?: string }) {
  const { Icon, color } = kindInfo(kind);
  return <Icon aria-hidden className={cn("size-4 shrink-0", color, className)} />;
}

export function FolderGlyph({ open = false, className }: { open?: boolean; className?: string }) {
  const Icon = open ? FolderOpenIcon : FolderIcon;
  return <Icon aria-hidden className={cn("size-4 shrink-0 text-amber-500", className)} />;
}

/** A dot that says whether a dataset reached its table: filled when loaded, a ring when not yet. */
export function LoadDot({ loaded, className }: { loaded: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        loaded ? "bg-emerald-600 dark:bg-emerald-400" : "ring-[1.5px] ring-amber-500 ring-inset",
        className,
      )}
    />
  );
}

const RUN_TONE: Record<string, string> = {
  success: "bg-emerald-600 dark:bg-emerald-400",
  running: "bg-sky-500 animate-pulse",
  partial: "bg-amber-500",
  failed: "bg-red-600 dark:bg-red-400",
  abandoned: "bg-slate-400",
};

export function RunDot({ status }: { status: string }) {
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", RUN_TONE[status] ?? "bg-slate-400")} />;
}
