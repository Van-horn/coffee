import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Self-hosting: `next build` writes a minimal server to .next/standalone (see docs/deploy-server.md).
  // Netlify's runtime builds Next itself and must not get the standalone output (see docs/netlify.md).
  ...(process.env.NETLIFY === "true" ? {} : { output: "standalone" as const }),
  // Native SQLite addon: loaded with plain require instead of being bundled, and traced into the standalone output.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
