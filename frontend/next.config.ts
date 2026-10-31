import type { NextConfig } from "next";

// The browser only ever talks to this Next.js server. API calls under /api/v1 are forwarded to the
// FastAPI backend, so the session cookie stays same-origin and no CORS setup is needed. The backend
// URL (and anything secret) stays on the server.
const backendUrl = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
