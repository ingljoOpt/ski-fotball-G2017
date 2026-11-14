import type { NextConfig } from "next";

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  serverExternalPackages: ["@electric-sql/pglite", "proper-lockfile", "pdf-parse"],
};

export default config;
