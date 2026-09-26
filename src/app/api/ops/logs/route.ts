import { withSession } from "@/lib/auth/session";
import { getLogs } from "@/lib/ops/queries";
import { parseRange } from "@/lib/ops/range";
import { OPS_LEVELS, OPS_SERVICES, type OpsLevel, type OpsService } from "@/lib/ops/types";

function listParam<T extends string>(value: string | null, allowed: readonly T[]): T[] | undefined {
  const items = (value ?? "").split(",").filter((v): v is T => (allowed as readonly string[]).includes(v));
  return items.length ? items : undefined;
}

/**
 * /ops Logs: `ops.log` lines, newest first. Filters: `level` and `service` (comma lists), `q` (text),
 * `request` or `run` (a whole request or run, whatever the range), `before` (next page).
 */
export const GET = withSession(async (request) => {
  const params = new URL(request.url).searchParams;
  const before = params.get("before");
  return Response.json(
    await getLogs({
      range: parseRange(params.get("range")),
      levels: listParam<OpsLevel>(params.get("level"), OPS_LEVELS),
      services: listParam<OpsService>(params.get("service"), OPS_SERVICES),
      q: params.get("q")?.slice(0, 200) || undefined,
      requestId: params.get("request") || undefined,
      runId: params.get("run") || undefined,
      before: before && /^\d{1,19}$/.test(before) ? before : undefined,
    }),
  );
});
