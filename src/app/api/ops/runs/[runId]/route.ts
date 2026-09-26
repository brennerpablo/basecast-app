import { withSession } from "@/lib/auth/session";
import { getRunDetail } from "@/lib/ops/queries";

/** One run: its etl_run row with events and params, plus its ops.log lines. */
export const GET = withSession<{ params: Promise<{ runId: string }> }>(async (_request, { params }) => {
  const detail = await getRunDetail((await params).runId);
  if (!detail) return Response.json({ error: "Run not found" }, { status: 404 });
  return Response.json(detail);
});
