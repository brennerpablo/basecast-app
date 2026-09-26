"use client";

import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

import { ChevronLeftIcon, ChevronRightIcon, FileXIcon, Loader2Icon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";

import EmptyState from "@/components/empty-state";
import { Button } from "@/components/ui/button";

import { formatBytes } from "./format";

type ReactPdf = typeof import("react-pdf");
type Progress = { loaded: number; total: number };

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.5;

function Loading({ progress }: { progress: Progress | null }) {
  const percent = progress && progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : null;
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
      {percent === null ? <Loader2Icon className="size-5 animate-spin" /> : <span className="text-2xl font-semibold text-foreground tabular-nums">{percent}%</span>}
      <span className="tabular-nums">
        {progress && progress.total > 0
          ? `${formatBytes(progress.loaded)} of ${formatBytes(progress.total)}`
          : "Opening the PDF…"}
      </span>
    </div>
  );
}

function Viewer({ pdf, url }: { pdf: ReactPdf; url: string }) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1));
  const [pages, setPages] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [width, setWidth] = useState(720);
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ranges only: pdf.js reads the pages it shows instead of the whole file.
  const options = useMemo(() => ({ disableAutoFetch: true, rangeChunkSize: 256 * 1024 }), []);
  const current = Math.min(Math.max(1, page), pages ?? 1);
  const go = (n: number) => void setPage(n <= 1 ? null : n);

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5">
        <Button variant="ghost" size="icon-sm" onClick={() => go(current - 1)} disabled={current <= 1} aria-label="Previous page">
          <ChevronLeftIcon />
        </Button>
        <span className="min-w-24 text-center text-xs tabular-nums">
          Page {current} of {pages ?? "…"}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => go(current + 1)} disabled={!pages || current >= pages} aria-label="Next page">
          <ChevronRightIcon />
        </Button>
        <span className="mx-1 h-4 w-px bg-border" />
        <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 0.25))} aria-label="Zoom out">
          <ZoomOutIcon />
        </Button>
        <span className="w-10 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
        <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 0.25))} aria-label="Zoom in">
          <ZoomInIcon />
        </Button>
      </div>
      <div ref={box} className="grid-scrollbar h-[68vh] min-h-[420px] overflow-auto bg-muted/40 p-4">
        <pdf.Document
          file={url}
          options={options}
          onLoadSuccess={({ numPages }) => setPages(numPages)}
          onLoadProgress={({ loaded, total }) => setProgress({ loaded, total })}
          loading={<Loading progress={progress} />}
          error={<EmptyState Icon={FileXIcon} title="The PDF could not be opened" description="Download it to read it offline." compact />}
          className="flex justify-center"
        >
          <pdf.Page
            pageNumber={current}
            width={Math.max(280, (width - 32) * zoom)}
            className="shadow-md"
            loading={<Loading progress={null} />}
          />
        </pdf.Document>
      </div>
    </div>
  );
}

/** A PDF from the lake, rendered by pdf.js in the browser (react-pdf, loaded on demand). */
export function PdfPreview({ url }: { url: string }) {
  const [pdf, setPdf] = useState<ReactPdf | null>(null);
  useEffect(() => {
    let cancelled = false;
    void import("react-pdf").then((mod) => {
      mod.pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      if (!cancelled) setPdf(mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!pdf) return <Loading progress={null} />;
  return <Viewer key={url} pdf={pdf} url={url} />;
}
