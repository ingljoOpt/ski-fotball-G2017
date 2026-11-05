"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getDatabase } from "@/db";
import { requireUser, SESSION_COOKIE } from "@/lib/auth";
import { localConfig } from "@/lib/config";
import {
  acceptInvitation, addTrainingTime, consumeLoginLink, createClub, createGroup,
  createLoginLink, DomainError, inviteCoach, removeMember, removeTrainingTime,
  revokeSession, updateGroupSettings, acceptClubInvitation, cancelClubInvitation,
  inviteClubAdmin, removeClubAdmin, transferHeadCoach,
  updateClubBranding, resetClubBranding,
} from "@/lib/domain";
import { idSchema } from "@/lib/validation";
import { logoFromForm } from "@/lib/logo";

const field = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};
const groupPath = (form: FormData) => {
  const id = idSchema.safeParse(field(form, "groupId"));
  return id.success ? `/grupper/${id.data}` : "/oversikt";
};
const clubPath = (form: FormData) => {
  const id = idSchema.safeParse(field(form, "clubId"));
  return id.success ? `/klubber/${id.data}` : "/oversikt";
};

async function run(fallback: string, operation: () => Promise<string>): Promise<never> {
  let destination: string;
  try {
    destination = await operation();
  } catch (error) {
    let message: string;
    if (error instanceof ZodError) message = error.issues.map((issue) => issue.message).join(" ");
    else if (error instanceof DomainError) message = error.message;
    else {
      console.error("Handlingen kunne ikke fullføres:", error);
      message = "Handlingen feilet. Kontroller serverloggen og prøv igjen.";
    }
    destination = `${fallback}?feil=${encodeURIComponent(message)}`;
  }
  redirect(destination);
}

export async function requestLogin(form: FormData) {
  const { appUrl } = localConfig();
  return run("/logg-inn", async () => {
    const token = await createLoginLink(await getDatabase(), field(form, "email"), field(form, "returnPath"));
    console.log(`[LOKAL MAGIC LINK] ${appUrl}/auth/local?token=${token}`);
    return "/logg-inn?sendt=1";
  });
}

export async function signIn(form: FormData) {
  localConfig();
  return run("/logg-inn", async () => {
    const { sessionToken, expiresAt, returnPath } = await consumeLoginLink(await getDatabase(), field(form, "token"));
    (await cookies()).set(SESSION_COOKIE, sessionToken, {
      httpOnly: true, sameSite: "lax", secure: false, expires: expiresAt, path: "/",
    });
    return returnPath;
  });
}

export async function signOut() {
  localConfig();
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await revokeSession(await getDatabase(), token);
  jar.delete(SESSION_COOKIE);
  redirect("/logg-inn");
}

export async function newClub(form: FormData) {
  const user = await requireUser();
  return run("/oversikt", async () => {
    const club = await createClub(await getDatabase(), user.id, field(form, "name"));
    return `/klubber/${club.id}`;
  });
}

export async function newGroup(form: FormData) {
  const user = await requireUser();
  return run("/oversikt", async () => {
    const { group, token, email } = await createGroup(
      await getDatabase(), user.id, field(form, "clubId"), field(form, "name"), field(form, "email"),
    );
    console.log(`[LOKAL INVITASJON til ${email}] ${localConfig().appUrl}/invitasjon/${token}`);
    return `/grupper/${group.id}?melding=${encodeURIComponent("Gruppen er opprettet. Invitasjonen til hovedtrener ligger i serverterminalen.")}`;
  });
}

export async function newCoachInvitation(form: FormData) {
  const user = await requireUser();
  return run(groupPath(form), async () => {
    const { token, email } = await inviteCoach(await getDatabase(), user.id, field(form, "groupId"), field(form, "email"));
    console.log(`[LOKAL INVITASJON til ${email}] ${localConfig().appUrl}/invitasjon/${token}`);
    return `${groupPath(form)}?melding=${encodeURIComponent("Invitasjonen ligger i serverterminalen og varer i sju dager.")}`;
  });
}

export async function joinGroup(form: FormData) {
  const user = await requireUser();
  return run("/oversikt", async () => {
    const groupId = await acceptInvitation(await getDatabase(), user.id, field(form, "token"));
    return `/grupper/${groupId}`;
  });
}

export async function deleteMember(form: FormData) {
  const user = await requireUser();
  return run(groupPath(form), async () => {
    await removeMember(await getDatabase(), user.id, field(form, "groupId"), field(form, "userId"));
    return `${groupPath(form)}?melding=${encodeURIComponent("Medlemmet er fjernet.")}`;
  });
}

export async function saveGroupSettings(form: FormData) {
  const user = await requireUser();
  return run(groupPath(form), async () => {
    await updateGroupSettings(await getDatabase(), user.id, field(form, "groupId"), {
      durationMinutes: field(form, "durationMinutes"), generationDaysBefore: field(form, "generationDaysBefore"),
    });
    return `${groupPath(form)}?melding=${encodeURIComponent("Innstillingene er lagret. Automatisk generering er ikke implementert ennå.")}`;
  });
}

export async function newTrainingTime(form: FormData) {
  const user = await requireUser();
  return run(groupPath(form), async () => {
    await addTrainingTime(await getDatabase(), user.id, field(form, "groupId"), {
      weekday: field(form, "weekday"), startTime: field(form, "startTime"),
    });
    return groupPath(form);
  });
}

export async function deleteTrainingTime(form: FormData) {
  const user = await requireUser();
  return run(groupPath(form), async () => {
    await removeTrainingTime(await getDatabase(), user.id, field(form, "groupId"), field(form, "timeId"));
    return groupPath(form);
  });
}

export async function newAdminInvitation(form: FormData) {
  const user = await requireUser();
  return run(clubPath(form), async () => {
    const { token, email } = await inviteClubAdmin(await getDatabase(), user.id, field(form, "clubId"), field(form, "email"));
    console.log(`[LOKAL KLUBBADMINISTRATORINVITASJON til ${email}] ${localConfig().appUrl}/klubbinvitasjon/${token}`);
    return `${clubPath(form)}?melding=${encodeURIComponent("Administratorinvitasjonen ligger i serverterminalen og varer i sju dager. En eventuell tidligere invitasjon er erstattet.")}`;
  });
}

export async function joinClubAdministration(form: FormData) {
  const user = await requireUser();
  return run("/oversikt", async () => {
    const clubId = await acceptClubInvitation(await getDatabase(), user.id, field(form, "token"));
    return `/klubber/${clubId}?melding=${encodeURIComponent("Du er nå klubbadministrator.")}`;
  });
}

export async function deleteClubAdmin(form: FormData) {
  const user = await requireUser();
  return run(clubPath(form), async () => {
    const targetUserId = field(form, "userId");
    await removeClubAdmin(await getDatabase(), user.id, field(form, "clubId"), targetUserId);
    return `${targetUserId === user.id ? "/oversikt" : clubPath(form)}?melding=${encodeURIComponent("Administratorrollen er fjernet. Eventuelle gruppemedlemskap beholdes.")}`;
  });
}

export async function revokeAdminInvitation(form: FormData) {
  const user = await requireUser();
  return run(clubPath(form), async () => {
    await cancelClubInvitation(await getDatabase(), user.id, field(form, "clubId"), field(form, "invitationId"));
    return `${clubPath(form)}?melding=${encodeURIComponent("Administratorinvitasjonen er tilbakekalt.")}`;
  });
}

export async function changeHeadCoach(form: FormData) {
  const user = await requireUser();
  return run(groupPath(form), async () => {
    await transferHeadCoach(await getDatabase(), user.id, field(form, "groupId"), field(form, "userId"));
    return `${groupPath(form)}?melding=${encodeURIComponent("Hovedtrenerrollen er overført. Tidligere hovedtrener er nå trener.")}`;
  });
}

export async function saveClubProfile(form: FormData) {
  const user = await requireUser();
  return run(clubPath(form), async () => {
    const logo = logoFromForm(form.get("logo"));
    await updateClubBranding(await getDatabase(), user.id, field(form, "clubId"), {
      primaryColor: field(form, "primaryColor"), accentColor: field(form, "accentColor"),
    }, logo, field(form, "removeLogo") === "on");
    return `${clubPath(form)}?melding=${encodeURIComponent("Klubbprofilen er lagret.")}`;
  });
}

export async function resetClubProfile(form: FormData) {
  const user = await requireUser();
  return run(clubPath(form), async () => {
    await resetClubBranding(await getDatabase(), user.id, field(form, "clubId"));
    return `${clubPath(form)}?melding=${encodeURIComponent("Standardfargene er gjenopprettet og logoen fjernet.")}`;
  });
}
