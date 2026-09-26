import { withSession } from "@/lib/auth/session";
import { getDataFetch, GetDataUnavailable } from "@/lib/get-data/client";
import { isForwarded, passHeaders } from "@/lib/get-data/routes";

type Context = { params: Promise<{ path: string[] }> };

/**
 * The /data browser's BFF: forwards GETs to basecast-get-data with the token, for the allowlisted paths
 * only (`lib/get-data/routes.ts`). JSON and bytes pass through as they come, `Range` included, so pdf.js
 * can read a PDF in parts.
 */
export const GET = withSession<Context>(async (request, { params }) => {
  const { path } = await params;
  const rest = path.join("/");
  if (!isForwarded(rest)) return Response.json({ detail: "Not found" }, { status: 404 });

  const range = request.headers.get("range");
  try {
    const upstream = await getDataFetch(`/${rest}`, {
      search: new URL(request.url).searchParams,
      headers: range ? { Range: range } : undefined,
      signal: request.signal,
    });
    const headers = new Headers({ "Cache-Control": "private, no-store" });
    passHeaders(upstream.headers, headers);
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    if (error instanceof GetDataUnavailable) {
      return Response.json({ detail: "The data API is not configured here." }, { status: 503 });
    }
    if (request.signal.aborted) return new Response(null, { status: 499 });
    return Response.json({ detail: "The data API did not answer." }, { status: 502 });
  }
});
