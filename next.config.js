/** @type {import('next').NextConfig} */
// The root's redirect to /insights lives in src/proxy.ts: visitors see the landing page there.
const nextConfig = {
  // The data routes read the recorded snapshot from disk (`src/lib/snapshot/reader.ts`); a path built at
  // run time is invisible to the file tracer.
  outputFileTracingIncludes: {
    "/api/data/**": ["./snapshot/**/*"],
  },
};

module.exports = nextConfig;
