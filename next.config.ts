import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root,
  },
  // Models change rarely; let browsers reuse them for a day and refresh in the background.
  async headers() {
    return [{ source: "/models/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] }];
  },
};

export default nextConfig;
