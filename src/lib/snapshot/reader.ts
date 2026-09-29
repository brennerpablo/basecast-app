import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";

import { MANIFEST, type Manifest } from "./paths";

/** Reads the recorded files under a snapshot root: parsed JSON, or text for the CSV; null when missing. */
export type Reader = {
  manifest(): Manifest;
  json<T>(file: string): T | null;
  text(file: string): string | null;
};

/**
 * A reader over `snapshot/` on disk. Each file is parsed once and kept for the life of the process: the
 * snapshot never changes under a deploy. The files reach the Vercel functions through
 * `outputFileTracingIncludes` in next.config.js.
 */
export function fileReader(root = join(process.cwd(), "snapshot")): Reader {
  const cache = new Map<string, unknown>();
  const load = (file: string, parse: (raw: string) => unknown) => {
    if (!cache.has(file)) {
      const path = join(root, file);
      if (!existsSync(path)) cache.set(file, null);
      else {
        const bytes = readFileSync(path);
        cache.set(file, parse((file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8")));
      }
    }
    return cache.get(file);
  };
  return {
    manifest: () => load(MANIFEST, JSON.parse) as Manifest,
    json: <T>(file: string) => load(file, JSON.parse) as T | null,
    text: (file: string) => load(file, (raw) => raw) as string | null,
  };
}
