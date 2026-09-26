"use client";

import { CopyIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { toast } from "sonner";

import { LAKE_BUCKET, lakeCrumbs, lakeHref } from "./lake-path";

export async function copyText(text: string, what: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error(`Could not copy the ${what.toLowerCase()}`);
  }
}

/** The bucket path of a folder or file, each part a link, with a button that copies the gs:// URI. */
export function LakeCrumbs({ lakeKey }: { lakeKey: string }) {
  const crumbs = lakeCrumbs(lakeKey);
  const uri = lakeKey ? `${LAKE_BUCKET}/${lakeKey}` : LAKE_BUCKET;
  return (
    <nav aria-label="Bucket path" className="flex flex-wrap items-center gap-1 font-mono text-xs text-muted-foreground">
      {crumbs.map((crumb, i) => {
        const last = i === crumbs.length - 1;
        return (
          <Fragment key={crumb.key || "bucket"}>
            {i > 0 ? <span aria-hidden>/</span> : null}
            {last ? (
              <span className="font-medium break-all text-foreground">{crumb.label}</span>
            ) : (
              <Link href={crumb.key ? lakeHref(crumb.key) : "/data"} className="hover:text-foreground hover:underline">
                {crumb.label}
              </Link>
            )}
          </Fragment>
        );
      })}
      <button
        type="button"
        onClick={() => void copyText(uri, "gs:// URI")}
        className="ml-1 grid size-6 place-items-center rounded hover:bg-accent hover:text-foreground"
        aria-label="Copy gs:// URI"
        title="Copy gs:// URI"
      >
        <CopyIcon className="size-3.5" />
      </button>
    </nav>
  );
}
