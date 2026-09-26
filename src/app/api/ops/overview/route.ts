import { withSession } from "@/lib/auth/session";
import { getOverview } from "@/lib/ops/queries";
import { parseRange } from "@/lib/ops/range";

/** /ops Overview: service health, traffic per bucket, top errors and the pipeline grid. */
export const GET = withSession(async (request) => {
  const range = parseRange(new URL(request.url).searchParams.get("range"));
  return Response.json(await getOverview(range));
});
