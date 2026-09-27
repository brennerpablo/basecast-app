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

const KINDS: Record<FileKind, { Icon: LucideIcon; color: string }> = {
  sheet: { Icon: FileSpreadsheetIcon, color: "text-emerald-700 dark:text-emerald-400" },
  text: { Icon: FileTextIcon, color: "text-teal-700 dark:text-teal-400" },
  parquet: { Icon: TableIcon, color: "text-violet-700 dark:text-violet-400" },
  json: { Icon: FileJson2Icon, color: "text-blue-700 dark:text-blue-400" },
  geojson: { Icon: MapIcon, color: "text-cyan-700 dark:text-cyan-400" },
  zip: { Icon: FileArchiveIcon, color: "text-amber-700 dark:text-amber-400" },
  pdf: { Icon: FileTextIcon, color: "text-red-700 dark:text-red-400" },
  slides: { Icon: PresentationIcon, color: "text-orange-700 dark:text-orange-400" },
  document: { Icon: FileTextIcon, color: "text-blue-700 dark:text-blue-400" },
  html: { Icon: FileTextIcon, color: "text-slate-600 dark:text-slate-400" },
  other: { Icon: FileIcon, color: "text-slate-500 dark:text-slate-400" },
};

function kindInfo(kind: FileKind) {
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
