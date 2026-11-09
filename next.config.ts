import type { NextConfig } from "next";

const config: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: { serverActions: { bodySizeLimit: "11mb" } },
  serverExternalPackages: ["@electric-sql/pglite", "proper-lockfile", "pdf-parse"],
  outputFileTracingIncludes: {
    "/grupper/*/ovelser/rediger/*": [
      "./publiserte/rediger-taktikk.html",
      "./publiserte/assets/site.css",
      "./publiserte/assets/taktikk*.js",
    ],
    "/*/*/ovelser/rediger/*": [
      "./publiserte/rediger-taktikk.html",
      "./publiserte/assets/site.css",
      "./publiserte/assets/taktikk*.js",
    ],
  },
};

export default config;
