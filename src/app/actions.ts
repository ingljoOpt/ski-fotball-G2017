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
import {
  changeTrainingStatus, createTrainingEvent, removePlanPeriod, saveAnnualPlan, savePlanPeriod, saveSessionPlan,
} from "@/lib/planning-domain";
import { yearSchema } from "@/lib/planning";

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
    destination = `${fallback}${fallback.includes("?") ? "&" : "?"}feil=${encodeURIComponent(message)}`;
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
  return run("/klubber/ny", async () => {
    const club = await createClub(await getDatabase(), user.id, field(form, "name"));
    return `/klubber/${club.id}`;
  });
}

export async function newGroup(form: FormData) {
  const user = await requireUser();
  return run(`${clubPath(form)}/grupper/ny`, async () => {
    const { group, token, email } = await createGroup(
      await getDatabase(), user.id, field(form, "clubId"), field(form, "name"), field(form, "email"), field(form, "birthYear"),
    );
    console.log(`[LOKAL INVITASJON til ${email}] ${localConfig().appUrl}/invitasjon/${token}`);
    return `/grupper/${group.id}?melding=${encodeURIComponent("Laget er opprettet. Invitasjonen til hovedtrener ligger i serverterminalen.")}`;
  });
}

export async function newCoachInvitation(form: FormData) {
  const user = await requireUser();
  return run(`${groupPath(form)}/brukere`, async () => {
    const { token, email } = await inviteCoach(await getDatabase(), user.id, field(form, "groupId"), field(form, "email"));
    console.log(`[LOKAL INVITASJON til ${email}] ${localConfig().appUrl}/invitasjon/${token}`);
    return `${groupPath(form)}/brukere?melding=${encodeURIComponent("Invitasjonen ligger i serverterminalen og varer i sju dager.")}`;
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
  return run(`${groupPath(form)}/brukere`, async () => {
    await removeMember(await getDatabase(), user.id, field(form, "groupId"), field(form, "userId"));
    return `${groupPath(form)}/brukere?melding=${encodeURIComponent("Medlemmet er fjernet.")}`;
  });
}

export async function saveGroupSettings(form: FormData) {
  const user = await requireUser();
  return run(`${groupPath(form)}/innstillinger`, async () => {
    await updateGroupSettings(await getDatabase(), user.id, field(form, "groupId"), {
      generationDaysBefore: field(form, "generationDaysBefore"),
      birthYear: field(form, "birthYear"),
    });
    return `${groupPath(form)}/innstillinger?melding=${encodeURIComponent("Innstillingene er lagret. Automatisk generering er ikke implementert ennå.")}`;
  });
}

export async function newTrainingTime(form: FormData) {
  const user = await requireUser();
  return run(`${groupPath(form)}/innstillinger`, async () => {
    await addTrainingTime(await getDatabase(), user.id, field(form, "groupId"), {
      weekday: field(form, "weekday"), startTime: field(form, "startTime"), endTime: field(form, "endTime"),
    });
    return `${groupPath(form)}/innstillinger`;
  });
}

export async function deleteTrainingTime(form: FormData) {
  const user = await requireUser();
  return run(`${groupPath(form)}/innstillinger`, async () => {
    await removeTrainingTime(await getDatabase(), user.id, field(form, "groupId"), field(form, "timeId"));
    return `${groupPath(form)}/innstillinger`;
  });
}

export async function newAdminInvitation(form: FormData) {
  const user = await requireUser();
  return run(`${clubPath(form)}/brukere`, async () => {
    const { token, email } = await inviteClubAdmin(await getDatabase(), user.id, field(form, "clubId"), field(form, "email"));
    console.log(`[LOKAL KLUBBADMINISTRATORINVITASJON til ${email}] ${localConfig().appUrl}/klubbinvitasjon/${token}`);
    return `${clubPath(form)}/brukere?melding=${encodeURIComponent("Administratorinvitasjonen ligger i serverterminalen og varer i sju dager. En eventuell tidligere invitasjon er erstattet.")}`;
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
  return run(`${clubPath(form)}/brukere`, async () => {
    const targetUserId = field(form, "userId");
    await removeClubAdmin(await getDatabase(), user.id, field(form, "clubId"), targetUserId);
    return `${targetUserId === user.id ? "/oversikt" : `${clubPath(form)}/brukere`}?melding=${encodeURIComponent("Administratorrollen er fjernet. Eventuelle gruppemedlemskap beholdes.")}`;
  });
}

export async function revokeAdminInvitation(form: FormData) {
  const user = await requireUser();
  return run(`${clubPath(form)}/brukere`, async () => {
    await cancelClubInvitation(await getDatabase(), user.id, field(form, "clubId"), field(form, "invitationId"));
    return `${clubPath(form)}/brukere?melding=${encodeURIComponent("Administratorinvitasjonen er tilbakekalt.")}`;
  });
}

export async function changeHeadCoach(form: FormData) {
  const user = await requireUser();
  return run(`${groupPath(form)}/brukere`, async () => {
    await transferHeadCoach(await getDatabase(), user.id, field(form, "groupId"), field(form, "userId"));
    return `${groupPath(form)}/brukere?melding=${encodeURIComponent("Hovedtrenerrollen er overført. Tidligere hovedtrener er nå trener.")}`;
  });
}

export async function saveClubProfile(form: FormData) {
  const user = await requireUser();
  return run(`${clubPath(form)}/innstillinger`, async () => {
    const logo = logoFromForm(form.get("logo"));
    await updateClubBranding(await getDatabase(), user.id, field(form, "clubId"), {
      primaryColor: field(form, "primaryColor"), accentColor: field(form, "accentColor"),
    }, logo, field(form, "removeLogo") === "on");
    return `${clubPath(form)}/innstillinger?melding=${encodeURIComponent("Klubbprofilen er lagret.")}`;
  });
}

export async function resetClubProfile(form: FormData) {
  const user = await requireUser();
  return run(`${clubPath(form)}/innstillinger`, async () => {
    await resetClubBranding(await getDatabase(), user.id, field(form, "clubId"));
    return `${clubPath(form)}/innstillinger?melding=${encodeURIComponent("Standardfargene er gjenopprettet og logoen fjernet.")}`;
  });
}

const planningPath = (form: FormData, page: "arsplan" | "kalender") => {
  const year = yearSchema.safeParse(field(form, "year"));
  return `${groupPath(form)}/${page}${year.success ? `?year=${year.data}` : ""}`;
};
const eventFields = (form: FormData) => ({
  date: field(form, "date"), startTime: field(form, "startTime"), endTime: field(form, "endTime"),
  title: field(form, "title"), theme: field(form, "theme"), objectives: field(form, "objectives"),
});
const eventPath = (form: FormData) => {
  const eventId = idSchema.safeParse(field(form, "eventId"));
  return eventId.success ? `${groupPath(form)}/okter/${eventId.data}` : groupPath(form);
};

export async function saveYearPlan(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form, "arsplan"), async () => {
    await saveAnnualPlan(await getDatabase(), user.id, field(form, "groupId"), {
      year: field(form, "year"), objectives: field(form, "objectives"),
    }, field(form, "revision"));
    return `${planningPath(form, "arsplan")}&melding=${encodeURIComponent("Årsplanen er lagret.")}`;
  });
}

export async function saveThemePeriod(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form, "arsplan"), async () => {
    await savePlanPeriod(await getDatabase(), user.id, field(form, "groupId"), yearSchema.parse(field(form, "year")), {
      startDate: field(form, "startDate"), endDate: field(form, "endDate"), theme: field(form, "theme"),
      objectives: field(form, "objectives"), progression: field(form, "progression"), sourceUrl: field(form, "sourceUrl"),
    }, field(form, "revision"), field(form, "periodId") || undefined);
    return `${planningPath(form, "arsplan")}&melding=${encodeURIComponent("Temaperioden er lagret. Eksisterende øktplaner er ikke endret.")}`;
  });
}

export async function deleteThemePeriod(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form, "arsplan"), async () => {
    await removePlanPeriod(await getDatabase(), user.id, field(form, "groupId"), field(form, "periodId"), field(form, "revision"));
    return `${planningPath(form, "arsplan")}&melding=${encodeURIComponent("Perioden er fjernet. Lagrede planversjoner beholdes.")}`;
  });
}

export async function newTrainingEvent(form: FormData) {
  const user = await requireUser();
  const month = Number(field(form, "month"));
  const year = yearSchema.safeParse(field(form, "year"));
  const singlePath = `${groupPath(form)}/okter/ny${year.success && Number.isInteger(month) && month >= 1 && month <= 12 ? `?year=${year.data}&month=${month}` : ""}`;
  return run(field(form, "singleSession") === "1" ? singlePath : planningPath(form, "kalender"), async () => {
    const eventId = await createTrainingEvent(await getDatabase(), user.id, field(form, "groupId"),
      eventFields(form), field(form, "recurrenceKey") || null, field(form, "intent") === "cancel");
    return `${groupPath(form)}/okter/${eventId}`;
  });
}

export async function saveTrainingPlan(_previous: { error: string } | null, form: FormData): Promise<{ error: string }> {
  const user = await requireUser();
  try {
    let plan: unknown;
    try { plan = JSON.parse(field(form, "plan")); }
    catch (error) {
      if (error instanceof SyntaxError) throw new DomainError("Øktplanen er ikke gyldig JSON.");
      throw error;
    }
    await saveSessionPlan(await getDatabase(), user.id, field(form, "groupId"), field(form, "eventId"),
      eventFields(form), plan, field(form, "revision"), field(form, "intent") === "approve" ? "planned" : "draft");
  } catch (error) {
    if (error instanceof ZodError) return { error: error.issues.map((issue) => issue.message).join(" ") };
    if (error instanceof DomainError) return { error: error.message };
    console.error("Øktplanen kunne ikke lagres:", error);
    return { error: "Lagring feilet. Kontroller serverloggen og prøv igjen. Endringene er beholdt i skjemaet." };
  }
  redirect(`${eventPath(form)}?melding=${encodeURIComponent("Ny planversjon er lagret.")}`);
}

export async function setTrainingStatus(form: FormData) {
  const user = await requireUser();
  return run(eventPath(form), async () => {
    await changeTrainingStatus(await getDatabase(), user.id, field(form, "groupId"), field(form, "eventId"),
      field(form, "revision"), field(form, "intent") === "cancel" ? "cancelled" : "draft");
    return `${eventPath(form)}?melding=${encodeURIComponent("Øktstatus er oppdatert. Planversjonene er bevart.")}`;
  });
}
