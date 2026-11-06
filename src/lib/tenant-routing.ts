import { clubUrl } from "./slugs.ts";
import { listClubGroups, teamAddress } from "./domain.ts";
import type { Database } from "../db/index.ts";

export async function canonicalDestination(db: Database, userId: string, destination: string) {
  const url = new URL(destination, "http://local.invalid");
  const team = /^\/grupper\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (team) {
    const suffix = (team[2] ?? "").replace(/^\/(?:arsplan|kalender)(?=\/|$)/, "/aarsplan");
    return `${await teamAddress(db, userId, team[1])}${suffix}${url.search}${url.hash}`;
  }
  const club = /^\/klubber\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (club && club[1] !== "ny") {
    const details = await listClubGroups(db, userId, club[1]);
    const suffix = (club[2] ?? "").replace(/^\/grupper\/ny$/, "/lag/ny");
    return `${clubUrl(details.club)}${suffix}${url.search}${url.hash}`;
  }
  return destination;
}

export function withSearch(path: string, search: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(search)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.append(key, value);
  }
  return `${path}${query.size ? `?${query}` : ""}`;
}
