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

export function toResponse(answer: Answer): Response {
  // The snapshot only changes with a deploy.
  const headers = new Headers({ "Cache-Control": "private, max-age=300", ...answer.headers });
  if (typeof answer.body === "string") return new Response(answer.body, { status: answer.status, headers });
  return Response.json(answer.body, { status: answer.status, headers });
}
