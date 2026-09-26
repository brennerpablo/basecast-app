"use client";

import {
  ArrowLeftIcon,
  ChevronRightIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  NetworkIcon,
  SearchIcon,
  TableIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";

import { SidebarChrome } from "@/app/(app)/_components/sidebar-chrome";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

import { useLakeList, useLakeSources, useTables } from "./api";
import { FolderGlyph } from "./file-kind";
import { formatBytes, formatCount } from "./format";
import { keyFromSegments, lakeHref, parseKey, sourceKey } from "./lake-path";

const DT_LIMIT = 40;

const itemClass =
  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";
const activeClass = "bg-brand text-brand-foreground hover:bg-brand hover:text-brand-foreground [&_svg]:text-brand-foreground";
const nodeClass =
  "flex min-w-0 flex-1 items-center gap-1.5 rounded-md py-1 pr-2 text-[13px] transition-colors hover:bg-sidebar-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

/** The key the current route shows, when it is under /data/lake. */
function routeKey(pathname: string): string | null {
  if (pathname === "/data/lake") return "";
  if (!pathname.startsWith("/data/lake/")) return null;
  return keyFromSegments(pathname.slice("/data/lake/".length).split("/"));
}

function NavItem({
  href,
  label,
  Icon,
  active,
  count,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
  count?: number;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(itemClass, active ? activeClass : "text-sidebar-foreground")}
    >
      <Icon className={cn("size-4 shrink-0", !active && "text-sidebar-foreground/70")} />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            active ? "bg-white/50 text-brand-foreground" : "bg-sidebar-accent text-sidebar-foreground/70",
          )}
        >
          {formatCount(count)}
        </span>
      ) : null}
    </Link>
  );
}

function Twisty({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      className="grid size-5 shrink-0 place-items-center rounded text-sidebar-foreground/60 hover:bg-sidebar-accent"
    >
      <ChevronRightIcon className={cn("size-3.5 transition-transform", open && "rotate-90")} />
    </button>
  );
}

/** The `dt=` folders of one source, loaded when the source is expanded. */
function DtFolders({ sourceId, activeKey, onNavigate }: { sourceId: string; activeKey: string | null; onNavigate: () => void }) {
  const listing = useLakeList(`${sourceKey(sourceId)}/`);
  const folders = listing.data?.folders ?? [];
  if (listing.isPending) return <p className="py-1 pl-12 text-xs text-sidebar-foreground/60">Loading…</p>;
  return (
    <ul>
      {folders.slice(0, DT_LIMIT).map((folder) => {
        const key = folder.prefix.replace(/\/$/, "");
        const active = activeKey !== null && (activeKey === key || activeKey.startsWith(`${key}/`));
        return (
          <li key={folder.prefix} className="flex items-center pl-9">
            <Link
              href={lakeHref(key)}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(nodeClass, "pl-1.5", active && activeClass)}
            >
              <FolderGlyph className="size-3.5" open={active} />
              <span className="flex-1 truncate font-mono text-xs">{folder.name}</span>
              <span className="text-[10px] tabular-nums opacity-70">{folder.files}</span>
            </Link>
          </li>
        );
      })}
      {folders.length > DT_LIMIT ? (
        <li className="pl-12">
          <Link
            href={lakeHref(sourceKey(sourceId))}
            onClick={onNavigate}
            className="block py-1 text-xs text-sidebar-foreground/70 hover:underline"
          >
            {formatCount(folders.length - DT_LIMIT)} more folders
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

/**
 * The sidebar of the Data mode, as in the Fundsys Documents module: the main menu gives way to the
 * mode's shortcuts and the bucket's folder tree while the route is under /data.
 */
export function DataSidebar({ footer }: { footer?: ReactNode }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const onNavigate = () => {
    if (isMobile) setOpenMobile(false);
  };
  const sources = useLakeSources();
  const tables = useTables();
  const [query, setQuery] = useState("");

  const activeKey = routeKey(pathname);
  const activeSource = activeKey ? parseKey(activeKey).sourceId : undefined;
  const [open, setOpen] = useState<Set<string>>(() => new Set(["raw", ...(activeSource ? [activeSource] : [])]));
  // Opening another source's page expands it in the tree (derived state, adjusted during render).
  const [seenSource, setSeenSource] = useState(activeSource);
  if (activeSource !== seenSource) {
    setSeenSource(activeSource);
    if (activeSource && !open.has(activeSource)) setOpen(new Set([...open, "raw", activeSource]));
  }
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const needle = query.trim().toLowerCase();
  const items = (sources.data?.items ?? []).filter(
    (s) => !needle || s.source_id.includes(needle) || s.name.toLowerCase().includes(needle),
  );
  const rawOpen = open.has("raw") || Boolean(needle);
  const declared = tables.data?.items.filter((t) => t.kind === "dataset").length;

  return (
    <SidebarChrome
      footer={footer}
      toolbar={
        <Link
          href="/explorer"
          onClick={onNavigate}
          className="flex h-8 w-full items-center gap-2 rounded-md border border-sidebar-border px-3 text-xs font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Exit Data
        </Link>
      }
    >
      <nav className="space-y-4 p-2" aria-label="Data">
        <div className="space-y-1">
          <NavItem href="/data" label="Overview" Icon={LayoutDashboardIcon} active={pathname === "/data"} onNavigate={onNavigate} />
          <NavItem
            href="/data/tables"
            label="Tables"
            Icon={TableIcon}
            active={pathname.startsWith("/data/tables")}
            count={declared}
            onNavigate={onNavigate}
          />
          <NavItem href="/data/runs" label="Pipeline runs" Icon={HistoryIcon} active={pathname.startsWith("/data/runs")} onNavigate={onNavigate} />
          <NavItem href="/data/flow" label="Flow" Icon={NetworkIcon} active={pathname.startsWith("/data/flow")} onNavigate={onNavigate} />
        </div>

        <div className="space-y-2">
          <p className="flex items-baseline justify-between px-3 text-[11px] font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
            Lake
            {sources.data ? (
              <span className="font-mono font-medium tracking-normal normal-case">{formatBytes(sources.data.totals.bytes)}</span>
            ) : null}
          </p>
          <div className="relative px-1">
            <SearchIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-sidebar-foreground/50" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter sources"
              aria-label="Filter sources"
              className="h-8 w-full rounded-md border border-sidebar-border bg-background pr-2 pl-7 text-xs outline-none focus:ring-2 focus:ring-sidebar-ring"
            />
          </div>
          <ul className="space-y-0.5">
            <li>
              <div className="flex items-center gap-0.5">
                <Twisty open={rawOpen} label="raw" onToggle={() => toggle("raw")} />
                <Link
                  href={lakeHref("raw")}
                  onClick={onNavigate}
                  className={cn(nodeClass, "pl-1", activeKey === "raw" && activeClass)}
                >
                  <FolderGlyph open={rawOpen} />
                  <span className="flex-1 truncate">raw</span>
                  <span className="text-[10px] tabular-nums opacity-70">
                    {sources.data ? formatCount(sources.data.totals.files) : ""}
                  </span>
                </Link>
              </div>
              {rawOpen ? (
                <ul className="space-y-0.5">
                  {sources.isPending ? <li className="py-1 pl-9 text-xs text-sidebar-foreground/60">Loading…</li> : null}
                  {sources.isError ? (
                    <li className="py-1 pl-9 text-xs text-destructive">{sources.error.message}</li>
                  ) : null}
                  {items.map((source) => {
                    const isOpen = open.has(source.source_id) && !needle;
                    const active = activeKey === sourceKey(source.source_id);
                    return (
                      <li key={source.source_id}>
                        <div className="flex items-center gap-0.5 pl-4">
                          <Twisty open={isOpen} label={source.source_id} onToggle={() => toggle(source.source_id)} />
                          <Link
                            href={lakeHref(sourceKey(source.source_id))}
                            onClick={onNavigate}
                            title={source.name}
                            aria-current={active ? "page" : undefined}
                            className={cn(nodeClass, "pl-1", active && activeClass)}
                          >
                            <FolderGlyph open={isOpen} className="size-3.5" />
                            <span className="flex-1 truncate font-mono text-xs">{source.source_id}</span>
                            <span className="text-[10px] tabular-nums opacity-70">{formatCount(source.files)}</span>
                          </Link>
                        </div>
                        {isOpen ? (
                          <DtFolders sourceId={source.source_id} activeKey={activeKey} onNavigate={onNavigate} />
                        ) : null}
                      </li>
                    );
                  })}
                  {needle && items.length === 0 && sources.data ? (
                    <li className="py-1 pl-9 text-xs text-sidebar-foreground/60">No source matches.</li>
                  ) : null}
                </ul>
              ) : null}
            </li>
            {["parquet", "derived"].map((layer) => (
              <li key={layer} className="flex items-center gap-0.5">
                <span className="size-5 shrink-0" />
                <Link
                  href={lakeHref(layer)}
                  onClick={onNavigate}
                  className={cn(nodeClass, "pl-1", activeKey === layer && activeClass)}
                >
                  <FolderGlyph />
                  <span className="flex-1 truncate">{layer}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </SidebarChrome>
  );
}
