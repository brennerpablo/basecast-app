import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import betterTailwind from "eslint-plugin-better-tailwindcss";
import reactHooks from "eslint-plugin-react-hooks";
import simpleImportSort from "eslint-plugin-simple-import-sort";

export default defineConfig([
  // The Prisma client, regenerated on npm install, and the web workers copied from their packages.
  globalIgnores(["src/generated/", "public/pdfjs/", "public/maplibre/"]),
  {
    extends: [...nextCoreWebVitals],

    plugins: {
      // Re-declared: a local `plugins` map replaces (does not merge) plugins
      // from `extends`, so react-hooks must be listed again for the RC rules.
      "react-hooks": reactHooks,
      "simple-import-sort": simpleImportSort,
    },

    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      // React Compiler rules (react-hooks v5 / Next.js 16). The compiler is not
      // enabled, so these stay advisory.
      "react-hooks/globals": "warn",
      "react-hooks/purity": "warn",
      // Fires on legit TanStack Table / react-hook-form / Radix callback
      // patterns the compiler can't analyze.
      "react-hooks/incompatible-library": "off",
      // Fires on intentional prop -> draft sync and reset-on-close patterns.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/preserve-manual-memoization": "off",
    },
  },
  {
    files: ["src/**/_components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "@/components/components-app/ui/badge",
              importNames: ["Badge"],
              message: "Use AppBadge or AppColoredBadge instead of Badge in product UI.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwind },
    settings: {
      "better-tailwindcss": { entryPoint: "src/app/globals.css" },
    },
    rules: {
      "better-tailwindcss/enforce-canonical-classes": [
        "warn",
        { collapse: false, logical: false },
      ],
    },
  },
  {
    // The component library keeps its own class order.
    files: [
      "src/components/ui/**/*.{ts,tsx}",
      "src/components/components-app/**/*.{ts,tsx}",
    ],
    rules: {
      "better-tailwindcss/enforce-canonical-classes": "off",
    },
  },
]);
