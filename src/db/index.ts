import { connectLocalDatabase } from "./local.ts";
import { localConfig } from "../lib/config.ts";

export type Database = Pick<Awaited<ReturnType<typeof connectLocalDatabase>>["db"], "select" | "insert" | "update" | "delete" | "transaction">;
const globalDatabase = globalThis as typeof globalThis & {
  localDatabase?: ReturnType<typeof connectLocalDatabase>;
};

export async function getDatabase() {
  const { dataDirectory } = localConfig();
  globalDatabase.localDatabase ??= connectLocalDatabase(dataDirectory);
  return (await globalDatabase.localDatabase).db;
}
