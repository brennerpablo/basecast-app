// Copies MapLibre's web worker and the chunk it imports to the app's static files, where the map points to
// them with `setWorkerUrl` (`/maplibre/maplibre-gl-worker.mjs`): its default URL is relative to its own
// bundle, which the app's bundler moves. Runs on every install, so the worker always matches its package.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`node_modules/maplibre-gl/dist/${file}`, `public/maplibre/${file}`);
}
