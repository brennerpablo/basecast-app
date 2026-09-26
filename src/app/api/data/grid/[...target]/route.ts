import { withSession } from "@/lib/auth/session";
import { getDataFetch, GetDataUnavailable } from "@/lib/get-data/client";
import { type RowsEnvelope, toGetDataParams, toGridBlock } from "@/lib/get-data/grid";

type Context = { params: Promise<{ target: string[] }> };

const TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/**
 * Blocks of rows for the DataGrid (`useGridWindowQuery`):
 * - `/api/data/grid/table/<name>` → get-data `/tables/<name>/rows`
 * - `/api/data/grid/lake?key=&member=&sheet=` → get-data `/lake/object/rows`
 */
export const GET = withSession<Context>(async (request, { params }) => {
  const { target } = await params;
  let path: string | null = null;
  if (target.length === 1 && target[0] === "lake") path = "/lake/object/rows";
  if (target.length === 2 && target[0] === "table" && TABLE.test(target[1])) {
    path = `/tables/${target[1]}/rows`;
  }
  if (!path) return Response.json({ detail: "Not found" }, { status: 404 });

  try {
    const upstream = await getDataFetch(path, {
      search: toGetDataParams(new URL(request.url).searchParams),
      signal: request.signal,
    });
    const body = (await upstream.json().catch(() => null)) as (RowsEnvelope & { detail?: unknown }) | null;
    if (!upstream.ok || !body?.data) {
      const detail = typeof body?.detail === "string" ? body.detail : "The rows could not be read.";
      return Response.json({ detail }, { status: upstream.ok ? 502 : upstream.status });
    }
    return Response.json(toGridBlock(body), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof GetDataUnavailable) {
      return Response.json({ detail: "The data API is not configured here." }, { status: 503 });
    }
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ detail: "The data API did not answer." }, { status: 502 });
  }
});
