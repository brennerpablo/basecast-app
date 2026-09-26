import { withSession } from "@/lib/auth/session";
import { getRouteStats } from "@/lib/ops/queries";
import { parseRange } from "@/lib/ops/range";

/** /ops Requests: count, errors and percentiles per route. `service` is `app` or `get-data`. */
export const GET = withSession(async (request) => {
  const params = new URL(request.url).searchParams;
  const service = params.get("service");
  return Response.json(
    await getRouteStats(
      parseRange(params.get("range")),
      service === "app" || service === "get-data" ? service : null,
    ),
  );
});
