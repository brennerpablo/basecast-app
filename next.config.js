/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Insights is the landing page. A config redirect, not a page: a page
    // that redirects would paint before leaving.
    return [{ source: "/", destination: "/insights", permanent: false }];
  },
};

module.exports = nextConfig;
