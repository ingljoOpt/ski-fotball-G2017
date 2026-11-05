import { resolve } from "node:path";

type Environment = Record<string, string | undefined>;

export function localConfig(env: Environment = process.env) {
  if (env.APP_ENV !== "local" || env.AUTH_MODE !== "local" ||
      env.NODE_ENV !== "development" || env.VERCEL || env.CI) {
    throw new Error("Lokal auth krever APP_ENV=local, AUTH_MODE=local og NODE_ENV=development uten Vercel/CI.");
  }
  const app = new URL(env.APP_URL ?? "http://localhost:3000");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(app.hostname) ||
      app.protocol !== "http:" || app.username || app.password ||
      app.pathname !== "/" || app.search || app.hash) {
    throw new Error("Lokal utviklingsmodus krever en lokal HTTP-origin som APP_URL.");
  }
  const directory = env.PGLITE_DATA_DIR ?? ".local/pglite";
  if (!directory.trim() || directory.includes("://")) {
    throw new Error("PGLITE_DATA_DIR må være en lokal filmappe.");
  }
  return { dataDirectory: resolve(/* turbopackIgnore: true */ directory), appUrl: app.origin };
}
