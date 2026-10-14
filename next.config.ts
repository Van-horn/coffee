import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Self-hosting: `next build` writes a minimal server to .next/standalone (see docs/deploy-server.md).
  output: "standalone",
  // Native SQLite addon: loaded with plain require instead of being bundled, and traced into the standalone output.
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
