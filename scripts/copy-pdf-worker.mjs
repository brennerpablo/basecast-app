// Copies pdf.js's worker next to the app's static files, where react-pdf loads it from
// (`/pdfjs/pdf.worker.min.mjs`). Runs on every install, so the worker always matches pdfjs-dist.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/pdfjs", { recursive: true });
copyFileSync("node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/pdfjs/pdf.worker.min.mjs");
