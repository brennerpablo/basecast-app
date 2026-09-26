"use client";

import {
  keepPreviousData,
  useQueries,
  useQueryClient,
} from "@tanstack/react-query";
import * as React from "react";

/**
 * Sparse block cache for the spreadsheet grid (`@/components/data-grid`).
 *
 * The grid virtualizes up to `maxWindow` rows and reports its viewport via
 * `onViewportChange`; this hook translates that into the set of fixed-size
 * blocks (`blockSize` rows) that must be resident — the viewport's blocks, the
 * one before, and the next one once the viewport's last row is within half a
 * block of it — and fans them out as parallel React Query entries keyed by
 * `[...queryKey, paramsQs, blockIndex]`. Blocks that scroll out of the window
 * drop from the active set but stay in the RQ cache until gc, so
 * back-scrolling is instant.
 *
 * Nothing past the last block the total reaches is ever requested, and nothing
 * but block 0 until block 0 tells the total. Sending the next block with every
 * load would be a second query — billed, on a BigQuery-backed route — even
 * when the result fits in block 0, and an empty one at the end of every longer
 * list. Find (Ctrl+F) and autosize work on the resident blocks, so right after
 * a load they see block 0 alone until the scroll reaches the next one.
 *
 * `paramsQs` (sort + filters, pre-serialized by the caller with
 * `buildGridParams`) namespaces every block: any sort/filter change produces
 * fresh keys, which IS the cache reset. `total`/`summary` ride on block 0
 * (`withSummary=1`) — no separate count query.
 *
 * The route contract (GET `apiUrl?offset=&limit=[&withSummary=1]&<paramsQs>`)
 * answers `GridBlockResponse`: the rows of `[offset, offset + limit)`, the
 * offset/limit it served (echoed — rows are placed by the echoed offset), and,
 * on the summary block, the uncapped filtered `total` and an optional
 * `summary`.
 */

export type GridBlockResponse<TRow, TSummary = GridSummary> = {
  rows: TRow[];
  /** The offset served — rows are placed by it, not by the request. */
  offset: number;
  limit: number;
  /** Uncapped filtered row count; present when `withSummary=1` was asked. */
  total?: number;
  /** Dataset-wide figures; present when `withSummary=1` was asked. */
  summary?: TSummary | null;
  /** ISO timestamp of when the server produced the data (e.g. the mart's build). */
  generatedAt: string;
};

/** Default summary shape: a filtered row count. Callers with a richer summary
 * pass their own type as the second generic argument. */
export type GridSummary = {
  count: number;
};

export type GridWindowQueryOptions = {
  /** GET endpoint (a BFF route) serving `?offset=&limit=&<paramsQs>` blocks. */
  apiUrl: string;
  /** Base query-key; the hook appends `paramsQs` and the block index. */
  queryKey: readonly unknown[];
  /** Serialized sort+filter querystring (no offset/limit) — `buildGridParams`. */
  paramsQs: string;
  /** Rows per block — must match the route's default. */
  blockSize?: number;
  /** Browsable window cap (matches the route's max offset). */
  maxWindow?: number;
  /** Pause fetching (e.g. until a required param is known). */
  enabled?: boolean;
};

export type GridWindowQueryResult<TRow, TSummary> = {
  /** O(1) sparse row accessor; `undefined` = block not loaded yet. */
  getRow: (index: number) => TRow | undefined;
  /** Virtualizer row count: `min(total, maxWindow)`; 0 while block 0 loads. */
  rowCount: number;
  /** Uncapped filtered total (for the status bar). */
  totalCount: number;
  summary: TSummary | null;
  /** Block 0's `generatedAt`; null until it loads. */
  generatedAt: string | null;
  isFetching: boolean;
  /** Showing the previous sort/filter's rows while the new ones load. */
  isRefreshing: boolean;
  isError: boolean;
  /** The first failed block's error, for the screen to report. */
  error: Error | null;
  /** Feed the virtualizer's visible range here. */
  onViewportChange: (startRow: number, endRow: number) => void;
};

export const DEFAULT_BLOCK_SIZE = 500;
export const DEFAULT_MAX_WINDOW = 100_000;

/**
 * The blocks a viewport needs: the block before the first visible row, every
 * block the viewport touches, and the next one once the last visible row is
 * within half a block of it — never past `maxBlock`. Block 0 is always in (it
 * carries total/summary). Sorted, no duplicates.
 */
export function blocksForViewport(
  startRow: number,
  endRow: number,
  blockSize: number,
  maxBlock: number,
): number[] {
  const lookahead = Math.floor(blockSize / 2);
  const first = Math.max(0, Math.floor(startRow / blockSize) - 1);
  const last = Math.min(maxBlock, Math.floor((endRow + lookahead) / blockSize));
  const blocks = new Set<number>([0]);
  for (let b = first; b <= last; b++) blocks.add(b);
  return [...blocks].sort((a, b) => a - b);
}

/** The URL of one block. `withSummary=1` rides on the window's block 0 only. */
export function blockUrl(
  apiUrl: string,
  block: number,
  blockSize: number,
  paramsQs: string,
  withSummary = block === 0,
): string {
  const qs = [
    `offset=${block * blockSize}`,
    `limit=${blockSize}`,
    ...(withSummary ? ["withSummary=1"] : []),
    ...(paramsQs ? [paramsQs] : []),
  ].join("&");
  return `${apiUrl}${apiUrl.includes("?") ? "&" : "?"}${qs}`;
}

/** The index of the last block holding rows, given block 0's total. */
export function lastUsefulBlock(
  total: number | undefined,
  blockSize: number,
): number {
  return total == null ? 0 : Math.max(0, Math.ceil(total / blockSize) - 1);
}

/**
 * Every row of the current sort/filter, block by block, for the grid's export
 * (`toolbar.export.fetchRows`) — the grid itself only ever holds a few blocks.
 * Same route and contract as the window; sequential, so a large export is a
 * queue of ordinary block requests rather than a burst. Stops at `cap` rows
 * (the toolbar then warns "exported the first N of M") or at the first short
 * block.
 */
export async function fetchGridExportRows<TRow>(opts: {
  apiUrl: string;
  paramsQs: string;
  /** Uncapped filtered total, when known — sizes the progress bar. */
  totalCount?: number;
  /** Most rows an export may carry. */
  cap?: number;
  blockSize?: number;
  onProgress?: (done: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<TRow[]> {
  const {
    apiUrl,
    paramsQs,
    totalCount,
    cap = DEFAULT_MAX_WINDOW,
    blockSize = 5_000,
    onProgress,
    signal,
  } = opts;
  const limit = Math.min(totalCount ?? cap, cap);
  const blocks = Math.max(1, Math.ceil(limit / blockSize));
  const out: TRow[] = [];
  for (let b = 0; b < blocks; b++) {
    // No summary: the export needs rows, not another count.
    const res = await fetch(blockUrl(apiUrl, b, blockSize, paramsQs, false), {
      signal,
    });
    if (!res.ok) throw new Error(`Block ${b} failed (${res.status})`);
    const json = (await res.json()) as GridBlockResponse<TRow, unknown>;
    out.push(...json.rows);
    onProgress?.(b + 1, blocks);
    if (json.rows.length < blockSize) break;
  }
  return out.slice(0, cap);
}

export function useGridWindowQuery<TRow, TSummary = GridSummary>(
  opts: GridWindowQueryOptions,
): GridWindowQueryResult<TRow, TSummary> {
  const {
    apiUrl,
    queryKey,
    paramsQs,
    blockSize = DEFAULT_BLOCK_SIZE,
    maxWindow = DEFAULT_MAX_WINDOW,
    enabled = true,
  } = opts;

  const maxBlock = Math.max(0, Math.ceil(maxWindow / blockSize) - 1);

  // Blocks that must be resident, keyed by the paramsQs they were computed
  // for. Block 0 is always needed — it carries total/summary. `settled` turns
  // true with the first top-anchored viewport after a (re)start: until then a
  // deep viewport is the stale scroll position of the previous key.
  const [blockState, setBlockState] = React.useState<{
    key: string;
    blocks: number[];
    settled: boolean;
  }>({ key: paramsQs, blocks: [0], settled: false });

  // New sort/filter combo → reset DURING RENDER (the React "adjust state on
  // prop change" pattern), not in an effect: useQueries runs in this same
  // render, and an effect-based reset would let one render fire deep-offset
  // fetches for the NEW key at the STALE scroll position — exactly the heavy
  // queries the route's max-offset guard exists to avoid.
  if (blockState.key !== paramsQs) {
    setBlockState({ key: paramsQs, blocks: [0], settled: false });
  }
  const neededBlocks = blockState.key === paramsQs ? blockState.blocks : [0];

  const onViewportChange = React.useCallback(
    (startRow: number, endRow: number) => {
      const sorted = blocksForViewport(startRow, endRow, blockSize, maxBlock);
      setBlockState((prev) => {
        // A stale deep viewport right after a sort/filter change (scroll not
        // yet snapped to top) must not re-add deep blocks for the new key:
        // after a key change, accept only top-anchored viewports until the
        // scroll reset lands. An explicit flag, not "blocks is just [0]": at
        // the top of the grid [0] is also the settled state, and a scrollbar
        // drag from there must go through.
        const first = Math.max(0, Math.floor(startRow / blockSize) - 1);
        if (!prev.settled && first > 1) return prev;
        const unchanged =
          sorted.length === prev.blocks.length &&
          sorted.every((b, i) => b === prev.blocks[i]);
        if (unchanged && prev.settled) return prev;
        return {
          key: prev.key,
          blocks: unchanged ? prev.blocks : sorted,
          settled: true,
        };
      });
    },
    [blockSize, maxBlock],
  );

  // Blocks past the total hold no rows: block 0 decides. Read from the cache
  // under THIS key, so until block 0 answers for the current sort/filter only
  // block 0 goes out. Block 0 is one of the queries below, so its arrival
  // re-renders and lands here.
  const queryClient = useQueryClient();
  const block0Total = queryClient.getQueryData<
    GridBlockResponse<TRow, TSummary>
  >([...queryKey, paramsQs, 0])?.total;
  const lastBlock = lastUsefulBlock(block0Total, blockSize);
  const activeBlocks = neededBlocks.filter(
    (block) => block === 0 || block <= lastBlock,
  );

  const results = useQueries({
    queries: activeBlocks.map((block) => ({
      queryKey: [...queryKey, paramsQs, block],
      queryFn: async ({
        signal,
      }: {
        signal: AbortSignal;
      }): Promise<GridBlockResponse<TRow, TSummary>> => {
        const res = await fetch(blockUrl(apiUrl, block, blockSize, paramsQs), {
          signal,
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        return (await res.json()) as GridBlockResponse<TRow, TSummary>;
      },
      enabled,
      // Keep blocks warm for the sitting: scrolling back is a cache hit.
      gcTime: 10 * 60 * 1000,
      // On sort/filter change every key changes; keep showing the previous
      // rows (under the grid's subtle refresh veil) instead of dropping to
      // an empty sheet while block 0 refetches.
      placeholderData: keepPreviousData,
      // A server-side timeout kills heavy queries; replaying them just
      // relaunches the same scan. Only network failures get one retry.
      retry: (failureCount: number, error: unknown) =>
        failureCount < 1 && error instanceof TypeError,
    })),
  });

  // Sparse Map<blockIndex, rows> rebuilt only when a block's data identity
  // changes. `getRow`'s identity changes with it — that identity change is
  // what re-renders the grid body when a block finishes loading.
  // Keyed by the OFFSET the response carries, not the slot's block index:
  // with keepPreviousData a slot whose key just changed can briefly hold
  // ANOTHER block's rows — trusting slot order would render them at the
  // wrong offsets.
  const dataStamp = results.map((r) => r.dataUpdatedAt).join(",");
  const blockMap = React.useMemo(() => {
    const map = new Map<number, TRow[]>();
    results.forEach((r) => {
      if (r.data) map.set(Math.floor(r.data.offset / blockSize), r.data.rows);
    });
    return map;
    // `results` is a new array every render; `dataStamp` is its data identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataStamp, blockSize]);

  const getRow = React.useCallback(
    (index: number): TRow | undefined =>
      blockMap.get(Math.floor(index / blockSize))?.[index % blockSize],
    [blockMap, blockSize],
  );

  // activeBlocks is sorted ascending and always contains 0 — block 0 is first.
  const block0 = results[0];
  const total = block0?.data?.total ?? 0;
  const summary = block0?.data?.summary ?? null;
  const failed = results.find((r) => r.isError);

  return {
    getRow,
    rowCount: Math.min(total, maxWindow),
    totalCount: total,
    summary,
    generatedAt: block0?.data?.generatedAt ?? null,
    isFetching: results.some((r) => r.isFetching),
    // True while the grid shows the PREVIOUS sort/filter's rows as
    // placeholder — drives the subtle refresh veil.
    isRefreshing: !!block0?.isPlaceholderData,
    isError: !!failed,
    error: failed?.error ?? null,
    onViewportChange,
  };
}
