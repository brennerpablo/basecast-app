import { withSession } from "@/lib/auth/session";
import { getDataFetch, getDataJson, GetDataUnavailable } from "@/lib/get-data/client";
import { passHeaders } from "@/lib/get-data/routes";

type SignedUrl = { data: { url: string | null } };

/**
 * A raw file's bytes, for viewers (pdf.js) and downloads. When get-data can sign a GCS URL the browser is
 * sent straight to the bucket, so big files never pass through here; otherwise the bytes are streamed
 * from get-data, `Range` included.
 */
export const GET = withSession(async (request) => {
  const url = new URL(request.url);
  const key = url.searchParams.get("key");
  const member = url.searchParams.get("member") ?? undefined;
  if (!key) return Response.json({ detail: "key is required" }, { status: 400 });

  try {
    if (!member) {
      const signed = await getDataJson<SignedUrl>("/lake/object/url", { search: { key } });
      if (signed.data.url) return Response.redirect(signed.data.url, 302);
    }
    const range = request.headers.get("range");
    const upstream = await getDataFetch("/lake/object/content", {
      search: { key, member },
      headers: range ? { Range: range } : undefined,
      signal: request.signal,
    });
    const headers = new Headers({ "Cache-Control": "private, max-age=3600" });
    passHeaders(upstream.headers, headers);
    if (url.searchParams.get("download") === "1") {
      const name = (member ?? key).split("/").at(-1) ?? "file";
      headers.set("content-disposition", `attachment; filename="${name.replace(/"/g, "")}"`);
    }
    return new Response(upstream.body, { status: upstream.status, headers });
  } catch (error) {
    if (error instanceof GetDataUnavailable) {
      return Response.json({ detail: "The data API is not configured here." }, { status: 503 });
    }
    return Response.json({ detail: "The file could not be read." }, { status: 502 });
  }
});
