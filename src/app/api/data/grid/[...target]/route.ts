import { withSession } from "@/lib/auth/session";
import { type RowsEnvelope, toGetDataParams, toGridBlock } from "@/lib/get-data/grid";
import { snapshotAnswer } from "@/lib/snapshot/serve";

type Context = { params: Promise<{ target: string[] }> };

const TABLE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/**
 * Blocks of rows for the DataGrid (`useGridWindowQuery`): `/api/data/grid/table/<name>` answers get-data's
 * `/tables/<name>/rows` from the snapshot, which holds each table's first rows.
 */
export const GET = withSession<Context>(async (request, { params }) => {
  const { target } = await params;
  if (target.length !== 2 || target[0] !== "table" || !TABLE.test(target[1])) {
    return Response.json({ detail: "Not found" }, { status: 404 });
  }
  const answer = snapshotAnswer(`tables/${target[1]}/rows`, toGetDataParams(new URL(request.url).searchParams));
  if (answer.status !== 200) return Response.json(answer.body, { status: answer.status });
  return Response.json(toGridBlock(answer.body as RowsEnvelope), { headers: { "Cache-Control": "private, max-age=300" } });
});
