import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import lockfile from "proper-lockfile";
import * as schema from "./schema.ts";

export async function connectLocalDatabase(directory: string) {
  const dataDirectory = resolve(directory);
  await mkdir(dataDirectory, { recursive: true });
  let release: () => Promise<void>;
  try {
    release = await lockfile.lock(dataDirectory, { retries: 0 });
  } catch (error) {
    throw new Error("PGlite-mappen er låst av en annen prosess. Stopp appen før separat migrering eller bruk en annen PGLITE_DATA_DIR.", { cause: error });
  }
  const client = new PGlite(dataDirectory);
  try {
    await client.waitReady;
  } catch (error) {
    await release();
    throw error;
  }
  return {
    client,
    db: drizzle(client, { schema }),
    async close() {
      try {
        await client.close();
      } finally {
        await release();
      }
    },
  };
}
