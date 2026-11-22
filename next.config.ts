import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { modelVersions } from "./src/app/modelVersions";

const root = dirname(fileURLToPath(import.meta.url));

// Content hash of every model, inlined into the client as `?v=` on model URLs (src/app/modelUrl.ts).
const MODEL_VERSIONS = modelVersions(join(root, "public/models"));
const DAY = "public, max-age=86400, stale-while-revalidate=604800";

const nextConfig: NextConfig = {
  agentRules: false,
  turbopack: {
    root,
  },
  env: {
    NEXT_PUBLIC_MODEL_VERSIONS: JSON.stringify(MODEL_VERSIONS),
  },
  async headers() {
    // A versioned model URL names exact bytes: cache it for a year without revalidating.
    // Unversioned requests (old links, anything that bypasses modelUrl) keep the one-day rule,
    // so they can never be pinned. In `next dev` a rebuilt model keeps its URL until the server
    // restarts, so the year-long rule is production only.
    const versioned = process.env.NODE_ENV === "production" ? "public, max-age=31536000, immutable" : DAY;
    return [
      { source: "/models/:path*", has: [{ type: "query", key: "v" }], headers: [{ key: "Cache-Control", value: versioned }] },
      { source: "/models/:path*", missing: [{ type: "query", key: "v" }], headers: [{ key: "Cache-Control", value: DAY }] },
    ];
  },
};

export default nextConfig;
