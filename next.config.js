/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // The Explorer is the landing page. A config redirect, not a page: a page
    // that redirects would paint before leaving.
    return [{ source: "/", destination: "/explorer", permanent: false }];
  },
};

module.exports = nextConfig;
