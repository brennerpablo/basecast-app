import "server-only";

import { fileReader } from "./reader";
import { type Answer, resolve } from "./resolve";

const reader = fileReader();

/** A get-data path and query answered from the recorded snapshot. */
export function snapshotAnswer(path: string, search: URLSearchParams): Answer {
  return resolve(path, search, reader);
}

/** When the snapshot was recorded, for the demo banner. */
export function recordedAt(): string {
  return reader.manifest().recordedAt;
}

/**
 * The snapshot only changes with a deploy, and Vercel's CDN cache is per deployment: an answer is cached at
 * the edge for a day and in the browser for an hour, so most requests never reach a function.
 */
export const SNAPSHOT_CACHE = "public, max-age=3600, s-maxage=86400";

export function toResponse(answer: Answer): Response {
  const headers = new Headers({ "Cache-Control": SNAPSHOT_CACHE, ...answer.headers });
  if (typeof answer.body === "string") return new Response(answer.body, { status: answer.status, headers });
  return Response.json(answer.body, { status: answer.status, headers });
}
