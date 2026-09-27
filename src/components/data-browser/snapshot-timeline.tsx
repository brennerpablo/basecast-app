"use client";

import Link from "next/link";

import type { Schemas } from "./api";
import { formatBytes, formatCount } from "./format";
import { lakeHref } from "./lake-path";

type Folder = Schemas["LakeFolder"];

function folderDate(folder: Folder): number {
  return Date.parse(folder.name.replace(/^dt=/, ""));
}

/**
 * One bar per `dt=` folder, placed by its date and as tall as the bytes fetched into it. Gaps in the
 * timeline are missing snapshots; each bar opens its folder.
 */
export function SnapshotTimeline({ folders, activeDt }: { folders: Folder[]; activeDt?: string }) {
  const dated = folders.filter((f) => !Number.isNaN(folderDate(f))).sort((a, b) => folderDate(a) - folderDate(b));
  if (dated.length < 3) return null;
  const t0 = folderDate(dated[0]);
  const t1 = folderDate(dated[dated.length - 1]);
  const span = Math.max(t1 - t0, 86_400_000);
  const max = Math.max(...dated.map((f) => f.bytes ?? 0), 1);
  const barWidth = Math.max(0.35, Math.min(1.2, 70 / dated.length));
  const y0 = new Date(t0).getUTCFullYear();
  const y1 = new Date(t1).getUTCFullYear();
  const step = y1 - y0 > 8 ? 2 : 1;
  const years: number[] = [];
  for (let y = y0 + 1; y <= y1; y += step) years.push(y);
  const left = (t: number) => ((t - t0) / span) * (100 - barWidth);

  return (
    <section className="rounded-lg border px-4 pt-3 pb-2">
      <h3 className="text-sm font-semibold">Snapshots</h3>
      <div className="relative mt-2 h-20 border-b">
        {dated.map((f) => {
          const dt = f.name.slice(3);
          const active = dt === activeDt;
          return (
            <Link
              key={f.prefix}
              href={lakeHref(f.prefix)}
              title={`${f.name} · ${formatCount(f.files)} files · ${formatBytes(f.bytes)}`}
              aria-label={`${f.name}, ${formatCount(f.files)} files`}
              className={`absolute bottom-0 rounded-t-[1px] transition-colors ${
                active ? "bg-basecast-brand" : "bg-basecast-brand/35 hover:bg-basecast-brand"
              }`}
              style={{
                left: `${left(folderDate(f))}%`,
                width: `${barWidth}%`,
                height: `${Math.max(4, ((f.bytes ?? 0) / max) * 100)}%`,
              }}
            />
          );
        })}
      </div>
      <div className="relative h-5 text-[10px] text-muted-foreground tabular-nums">
        {years.map((y) => (
          <span key={y} className="absolute -translate-x-1/2 pt-1" style={{ left: `${left(Date.UTC(y, 0, 1))}%` }}>
            {y}
          </span>
        ))}
      </div>
    </section>
  );
}
