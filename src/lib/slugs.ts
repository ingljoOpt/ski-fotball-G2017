import { z } from "zod";

export const reservedClubSlugs = ["auth", "api", "grupper", "klubber", "oversikt", "logg-inn", "invitasjon", "klubbinvitasjon", "media", "assets", "publiserte"];
export const reservedTeamSlugs = ["brukere", "innstillinger", "lag", "ny", "okter", "kalender", "aarsplan", "ovelser"];
export const slugSchema = z.string().max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Ugyldig nettadresse.");

export function slugBase(name: string, kind: "club" | "team") {
  const slug = name.toLowerCase().replaceAll("æ", "ae").replaceAll("ø", "o").replaceAll("å", "a")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80).replace(/-$/, "");
  return slug || (kind === "club" ? "klubb" : "lag");
}

export const clubUrl = (club: { slug: string }) => `/${club.slug}`;
export const teamUrl = (club: { slug: string }, team: { slug: string }) => `${clubUrl(club)}/${team.slug}`;
