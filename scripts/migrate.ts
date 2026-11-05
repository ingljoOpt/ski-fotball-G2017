import { config } from "dotenv";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { pathToFileURL } from "node:url";
import { connectLocalDatabase } from "../src/db/local.ts";
import { localConfig } from "../src/lib/config.ts";

config({ path: ".env.local", quiet: true });

export async function migrateDatabase(url: string) {
  const client = postgres(url, { max: 1 });
  try {
    // A session lock serializes independent startup processes on the same database.
    await client`select pg_advisory_lock(2017, 1)`;
    try {
      await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    } finally {
      await client`select pg_advisory_unlock(2017, 1)`;
    }
  } finally {
    await client.end();
  }
}

export async function migrateLocalDatabase(directory: string) {
  const connection = await connectLocalDatabase(directory);
  try {
    await migratePglite(connection.db, { migrationsFolder: "drizzle" });
  } finally {
    await connection.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.env.APP_ENV === "local") {
    const { dataDirectory } = localConfig({ ...process.env, NODE_ENV: process.env.NODE_ENV ?? "development" });
    await migrateLocalDatabase(dataDirectory);
  } else {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL mangler.");
    await migrateDatabase(process.env.DATABASE_URL);
  }
  console.log("Databasemigrering fullført.");
}
