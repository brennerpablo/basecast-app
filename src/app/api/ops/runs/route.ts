import { withSession } from "@/lib/auth/session";
import { getRuns } from "@/lib/ops/queries";
import { parseRange } from "@/lib/ops/range";

/** /ops Pipelines: the etl_run rows in the range, newest first. */
export const GET = withSession(async (request) => {
  return Response.json(await getRuns(parseRange(new URL(request.url).searchParams.get("range"))));
});
