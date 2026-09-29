import { withRequestLog } from "@/lib/observability";
import { snapshotAnswer, toResponse } from "@/lib/snapshot/serve";

type Context = { params: Promise<{ path: string[] }> };

/**
 * The BFF over the data: `/api/data/<path>` answers what get-data `/<path>` answered, from the recorded
 * snapshot (`src/lib/snapshot/`). Paths the snapshot does not hold are a 404.
 */
export const GET = withRequestLog<Context>(async (request, { params }) => {
  const { path } = await params;
  return toResponse(snapshotAnswer(path.join("/"), new URL(request.url).searchParams));
});
