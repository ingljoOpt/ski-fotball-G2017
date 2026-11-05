import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatabase } from "../db/index.ts";
import { localConfig } from "./config.ts";
import { userForSession } from "./domain.ts";

export const SESSION_COOKIE = "klubbokter_local_session";

export async function currentUser() {
  localConfig();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? userForSession(await getDatabase(), token) : null;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/logg-inn");
  return user;
}
