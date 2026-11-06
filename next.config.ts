import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite", "proper-lockfile"],
  outputFileTracingIncludes: {
    "/grupper/*/ovelser/rediger/*": [
      "./publiserte/rediger-taktikk.html",
      "./publiserte/assets/site.css",
      "./publiserte/assets/taktikk*.js",
    ],
  },
};

export default config;
