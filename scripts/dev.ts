import { config } from "dotenv";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { localConfig } from "../src/lib/config.ts";
import { migrateLocalDatabase } from "./migrate.ts";

config({ path: ".env.local", quiet: true });
const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "development" };
const { dataDirectory, appUrl } = localConfig(environment);
const appAddress = new URL(appUrl);

await migrateLocalDatabase(dataDirectory);
console.log(`PGlite er migrert og lagres i ${dataDirectory}. Starter Next.js på ${appUrl}.`);
const require = createRequire(import.meta.url);
const server = spawn(process.execPath, [
  require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1",
  "--port", appAddress.port || (appAddress.protocol === "https:" ? "443" : "80"),
], {
  stdio: "inherit",
  env: environment,
});
server.on("error", (error) => { throw error; });
server.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.kill(signal));
}
