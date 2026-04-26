import type { NextConfig } from "next";
import path from "path";

// __dirname here is always the frontend/ directory — resolved at BUILD time.
// This absolute path is baked into the bundle, so the standalone server
// always knows where data/ is regardless of what cwd Hostinger uses.
const DATA_DIR = path.join(__dirname, "..", "data");

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  env: {
    DATA_DIR,
  },
  turbopack: {
    root: __dirname,
  },
  experimental: {
    optimizePackageImports: ["shiki", "fuse.js"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        source: "/search-index.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        source: "/_next/static/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
