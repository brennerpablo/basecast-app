// Copies the web workers the browser loads from the app's static files. Runs on every install, so each
// worker always matches its package:
// - pdf.js's worker, which react-pdf loads from `/pdfjs/pdf.worker.min.mjs`;
// - MapLibre's worker and the chunk it imports, which the map points to with `setWorkerUrl`
//   (`/maplibre/maplibre-gl-worker.mjs`): its default URL is relative to its own bundle, which the app's
//   bundler moves.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/pdfjs", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdfjs/pdf.worker.min.mjs");

mkdirSync("public/maplibre", { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`node_modules/maplibre-gl/dist/${file}`, `public/maplibre/${file}`);
}
