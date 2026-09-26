"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { components } from "@/lib/api/get-data";

/** Types of the get-data contract, generated from its openapi.json (`npm run api:generate`). */
export type Schemas = components["schemas"];
export type SourceSummary = Schemas["SourceSummary"];
export type SourcesData = Schemas["SourcesData"];
export type LakeListing = Schemas["LakeListing"];
export type LakeObject = Schemas["LakeObject"];
export type ObjectDetail = Schemas["ObjectDetail"];
export type ObjectStructure = Schemas["ObjectStructure"];
export type ObjectText = Schemas["ObjectText"];
export type JsonNode = Schemas["JsonNode"];
export type RowsPage = Schemas["RowsPage"];
export type GridColumnInfo = Schemas["GridColumn"];
export type TableSummary = Schemas["TableSummary"];
export type TableDetail = Schemas["TableDetail"];
export type LineagePage = Schemas["LineagePage"];
export type RunsPage = Schemas["RunsPage"];
export type FileKind = LakeObject["kind"];

/** An error from the BFF or get-data, with its `detail` as the message. */
export class DataApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type Params = Record<string, string | number | boolean | null | undefined | string[]>;

export function dataUrl(path: string, params?: Params): string {
  const qs = new URLSearchParams();
  for (const [name, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) value.forEach((v) => qs.append(name, v));
    else qs.set(name, String(value));
  }
  const query = qs.toString();
  return `/api/data/${path}${query ? `?${query}` : ""}`;
}

/** GET a get-data resource through the BFF and return its `data`. */
export async function fetchData<T>(path: string, params?: Params, signal?: AbortSignal): Promise<T> {
  const response = await fetch(dataUrl(path, params), { signal });
  const body = (await response.json().catch(() => null)) as { data?: T; detail?: unknown } | null;
  if (!response.ok || !body || body.data === undefined) {
    const detail = typeof body?.detail === "string" ? body.detail : `The data API answered ${response.status}.`;
    throw new DataApiError(detail, response.status);
  }
  return body.data;
}

/** The URL a viewer or a download link reads a raw file's bytes from. */
export function fileUrl(key: string, member?: string | null, download = false): string {
  const qs = new URLSearchParams({ key });
  if (member) qs.set("member", member);
  if (download) qs.set("download", "1");
  return `/api/data/file?${qs.toString()}`;
}

export const dataKeys = {
  all: ["data"] as const,
  sources: () => ["data", "sources"] as const,
  list: (prefix: string, q: string, recursive: boolean) => ["data", "list", prefix, q, recursive] as const,
  object: (key: string) => ["data", "object", key] as const,
  structure: (key: string, member: string | null) => ["data", "structure", key, member] as const,
  text: (key: string, member: string | null) => ["data", "text", key, member] as const,
  tables: () => ["data", "tables"] as const,
  table: (name: string) => ["data", "table", name] as const,
  lineage: (name: string, offset: number) => ["data", "lineage", name, offset] as const,
  runs: (source: string | null) => ["data", "runs", source] as const,
};

export function useLakeSources() {
  return useQuery({
    queryKey: dataKeys.sources(),
    queryFn: ({ signal }) => fetchData<SourcesData>("lake/sources", undefined, signal),
  });
}

export function useLakeList(prefix: string, { q = "", recursive = false, enabled = true } = {}) {
  return useQuery({
    queryKey: dataKeys.list(prefix, q, recursive),
    queryFn: ({ signal }) =>
      fetchData<LakeListing>("lake/list", { prefix, q, recursive: recursive || undefined, limit: 1000 }, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useLakeObject(key: string) {
  return useQuery({
    queryKey: dataKeys.object(key),
    queryFn: ({ signal }) => fetchData<ObjectDetail>("lake/object", { key }, signal),
  });
}

export function useObjectStructure(key: string, member: string | null, enabled = true) {
  return useQuery({
    queryKey: dataKeys.structure(key, member),
    queryFn: ({ signal }) => fetchData<ObjectStructure>("lake/object/structure", { key, member }, signal),
    enabled,
    // Raw files never change under a key.
    staleTime: Infinity,
  });
}

export function useObjectText(key: string, member: string | null) {
  return useQuery({
    queryKey: dataKeys.text(key, member),
    queryFn: ({ signal }) => fetchData<ObjectText>("lake/object/text", { key, member }, signal),
    staleTime: Infinity,
  });
}

export function useTables() {
  return useQuery({
    queryKey: dataKeys.tables(),
    queryFn: ({ signal }) => fetchData<{ items: TableSummary[] }>("tables", undefined, signal),
  });
}

export function useTable(name: string) {
  return useQuery({
    queryKey: dataKeys.table(name),
    queryFn: ({ signal }) => fetchData<TableDetail>(`tables/${encodeURIComponent(name)}`, undefined, signal),
  });
}

export function useLineage(name: string, offset: number, enabled = true) {
  return useQuery({
    queryKey: dataKeys.lineage(name, offset),
    queryFn: ({ signal }) =>
      fetchData<LineagePage>(`tables/${encodeURIComponent(name)}/lineage`, { offset, limit: 200 }, signal),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useRuns(source: string | null) {
  return useQuery({
    queryKey: dataKeys.runs(source),
    queryFn: ({ signal }) => fetchData<RunsPage>("pipeline/runs", { source, limit: 1000 }, signal),
  });
}
