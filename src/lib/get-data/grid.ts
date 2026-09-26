/**
 * The DataGrid's block contract (`useGridWindowQuery`) on top of get-data's rows endpoints.
 *
 * The grid asks `?offset=&limit=[&withSummary=1][&sort=&dir=]&<filter params>`, where the filter params
 * are the names each column's `paramMap` gives (`gridFilterParams`). get-data takes
 * `filter=<column>:<op>:<value>`, `desc` and `with_summary`, and answers rows as arrays in column order;
 * the grid wants objects keyed by column id.
 */

export const FILTER_PREFIX = "f.";
const OPS = new Set(["eq", "contains", "starts", "in", "gte", "lte"]);

/** The query-param names a column's filter maps to (`f.<column>.<op>`). */
export function gridFilterParams(column: string) {
  const p = (op: string) => `${FILTER_PREFIX}${column}.${op}`;
  return {
    equals: p("eq"),
    contains: p("contains"),
    startsWith: p("starts"),
    csv: p("in"),
    range: { min: p("gte"), max: p("lte") },
  };
}

/** The grid's block request as get-data's query. Unknown params pass through (`key`, `sheet`...). */
export function toGetDataParams(search: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams();
  for (const [name, value] of search) {
    if (name === "withSummary") {
      if (value === "1") out.set("with_summary", "true");
    } else if (name === "dir") {
      if (value === "desc") out.set("desc", "true");
    } else if (name.startsWith(FILTER_PREFIX)) {
      const rest = name.slice(FILTER_PREFIX.length);
      const dot = rest.lastIndexOf(".");
      const column = rest.slice(0, dot);
      const op = rest.slice(dot + 1);
      if (dot > 0 && OPS.has(op) && value !== "") out.append("filter", `${column}:${op}:${value}`);
    } else {
      out.append(name, value);
    }
  }
  return out;
}

export type RowsEnvelope = {
  meta: { generated_at: string };
  data: {
    columns: { name: string }[];
    rows: unknown[][];
    offset: number;
    limit: number;
    total?: number | null;
    total_estimated?: boolean;
  };
};

export type GridBlock = {
  rows: Record<string, unknown>[];
  offset: number;
  limit: number;
  total?: number;
  summary?: { count: number; estimated: boolean };
  generatedAt: string;
};

export function toGridBlock(body: RowsEnvelope): GridBlock {
  const { columns, rows, offset, limit, total, total_estimated } = body.data;
  const names = columns.map((c) => c.name);
  const block: GridBlock = {
    rows: rows.map((row) => Object.fromEntries(names.map((name, i) => [name, row[i] ?? null]))),
    offset,
    limit,
    generatedAt: body.meta.generated_at,
  };
  if (total !== null && total !== undefined) {
    block.total = total;
    block.summary = { count: total, estimated: Boolean(total_estimated) };
  }
  return block;
}
