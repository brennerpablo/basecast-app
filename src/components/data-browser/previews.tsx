"use client";

import { FileTextIcon } from "lucide-react";
import Link from "next/link";

import EmptyState from "@/components/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

import { type JsonNode, type Schemas, useObjectText } from "./api";
import { FileKindIcon } from "./file-kind";
import { formatBytes, middleTruncate } from "./format";
import { lakeHref } from "./lake-path";

/** The members of a zip; each one opens in the same page with `?member=`. */
export function ZipMembers({ lakeKey, members }: { lakeKey: string; members: Schemas["ZipMember"][] }) {
  if (members.length === 0) return <EmptyState Icon={FileTextIcon} title="This archive is empty" compact />;
  return (
    <div className="grid-scrollbar max-h-[62vh] overflow-auto">
      <table className="w-full text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
        <thead className="sticky top-0 bg-muted/80 text-left text-xs tracking-wide text-muted-foreground uppercase backdrop-blur">
          <tr>
            <th className="px-3 py-2 font-medium">Member</th>
            <th className="px-3 py-2 text-right font-medium">Size</th>
            <th className="px-3 py-2 text-right font-medium">Compressed</th>
            <th className="px-3 py-2 font-medium">Modified</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {members.map((m) => (
            <tr key={m.name} className="relative hover:bg-accent/60">
              <td className="px-3 py-2">
                <Link
                  href={lakeHref(lakeKey, { member: m.name })}
                  title={m.name}
                  className="flex items-center gap-2 after:absolute after:inset-0"
                >
                  <FileKindIcon kind={m.kind} />
                  <span className="font-mono text-xs">{middleTruncate(m.name, 72)}</span>
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatBytes(m.bytes)}</td>
              <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{formatBytes(m.compressed_bytes)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{m.modified ? m.modified.replace("T", " ") : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The text of a pptx (per slide), docx (per section) or html page. */
export function TextBlocks({ lakeKey, member }: { lakeKey: string; member: string | null }) {
  const text = useObjectText(lakeKey, member);
  if (text.isPending) return <Skeleton className="h-96 w-full" />;
  if (text.isError) return <EmptyState Icon={FileTextIcon} title="The text could not be read" description={text.error.message} />;
  if (text.data.blocks.length === 0) return <EmptyState Icon={FileTextIcon} title="No text in this file" compact />;
  return (
    <div className="grid-scrollbar max-h-[68vh] space-y-3 overflow-auto p-4">
      {text.data.blocks.map((block, i) => (
        <section key={i} className="rounded-md border bg-background p-4">
          {block.title ? <h4 className="mb-2 text-sm font-semibold">{block.title}</h4> : null}
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-foreground/90">{block.text || "—"}</p>
        </section>
      ))}
    </div>
  );
}

function JsonValue({ node }: { node: JsonNode }) {
  if (node.type === "string") return <span className="text-red-700 dark:text-red-300">&quot;{node.value}&quot;</span>;
  if (node.type === "null") return <span className="text-muted-foreground">null</span>;
  return <span className="text-blue-700 dark:text-blue-300">{node.value}</span>;
}

function JsonBranch({ node, depth }: { node: JsonNode; depth: number }) {
  const label = node.key !== null && node.key !== undefined ? <span className="text-basecast-brand">{node.key}</span> : null;
  if (node.type !== "object" && node.type !== "array") {
    return (
      <div>
        {label}
        {label ? ": " : null}
        <JsonValue node={node} />
      </div>
    );
  }
  const children = node.children ?? [];
  const more = (node.length ?? 0) - children.length;
  return (
    <details open={depth < 2}>
      <summary className="cursor-pointer select-none">
        {label}
        {label ? ": " : null}
        <span className="text-muted-foreground">
          {node.type === "array" ? `[${node.length}]` : `{${node.length}}`}
        </span>
      </summary>
      <div className="ml-4 border-l pl-3">
        {children.map((child, i) => (
          <JsonBranch key={`${child.key}-${i}`} node={child} depth={depth + 1} />
        ))}
        {more > 0 ? <div className="text-muted-foreground">… {more.toLocaleString("en-US")} more</div> : null}
      </div>
    </details>
  );
}

/** A JSON document as a collapsible tree; arrays show their first items and their length. */
export function JsonTree({ node }: { node: JsonNode }) {
  return (
    <div className="grid-scrollbar max-h-[62vh] overflow-auto p-4 font-mono text-xs leading-6">
      <JsonBranch node={node} depth={0} />
    </div>
  );
}
