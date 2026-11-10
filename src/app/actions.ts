"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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
  createTrainingEvent, deleteSessionPlan, removeAnnualEvent, removePlanPeriod, saveAnnualEvent, saveAnnualPlan, savePlanPeriod, saveSessionPlan,
  setTrainingCancellation, saveSessionFocus, annualPlanning, unlockPlanMonth,
} from "@/lib/planning-domain";
import { yearSchema } from "@/lib/planning";
import { canonicalDestination } from "@/lib/tenant-routing";
import { refreshNffCurriculum } from "@/lib/nff-curriculum";
import { archiveClubDocument, saveClubMarkdown, uploadClubDocuments } from "@/lib/club-documents";
import { saveSessionReview } from "@/lib/session-review-domain";

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

export async function uploadDocuments(form: FormData) {
  const user = await requireUser();
  return run(`${clubPath(form)}/lag/sportsplan`, async () => {
    const files = form.getAll("documents").filter((value): value is File => value instanceof File && Boolean(value.name));
    await uploadClubDocuments(await getDatabase(), user.id, field(form, "clubId"), files);
    return `${clubPath(form)}/lag/sportsplan?melding=${encodeURIComponent("Dokumentene er lastet opp.")}`;
  });
}

export async function archiveDocument(form: FormData) {
  const user = await requireUser();
  return run(`${clubPath(form)}/lag/sportsplan`, async () => {
    await archiveClubDocument(await getDatabase(), user.id, field(form, "clubId"), field(form, "documentId"));
    return `${clubPath(form)}/lag/sportsplan?melding=${encodeURIComponent("Dokumentet er fjernet fra aktive klubbkilder.")}`;
  });
}

export async function saveMarkdown(_state: { message: string; saved: boolean }, form: FormData) {
  const user = await requireUser();
  try {
    await saveClubMarkdown(await getDatabase(), user.id, field(form, "clubId"), field(form, "documentId"), field(form, "name"), field(form, "content"));
    revalidatePath(await canonicalDestination(await getDatabase(), user.id, `${clubPath(form)}/lag/sportsplan`));
    return { message: "Markdown-dokumentet er lagret.", saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message, saved: false };
    if (error instanceof ZodError) return { message: "Ugyldig dokument eller klubb.", saved: false };
    console.error("Markdown-dokumentet kunne ikke lagres:", error);
    return { message: "Lagringen feilet. Teksten er beholdt i skjemaet; prøv igjen.", saved: false };
  }
}

export async function saveReview(_state: { message: string; saved: boolean }, form: FormData) {
  const user = await requireUser();
  try {
    const ids = form.getAll("exerciseId");
    if (ids.length > 30 || ids.some((id) => typeof id !== "string")) throw new DomainError("Ugyldige øvelser i evalueringen.");
    const exercises = ids.map((id) => {
      const exerciseId = String(id);
      const rating = field(form, `rating.${exerciseId}`);
      return { exerciseId, rating: rating === "" ? null : /^[0-5]$/.test(rating) ? Number(rating) : NaN,
        comment: field(form, `comment.${exerciseId}`) };
    });
    const db = await getDatabase();
    await saveSessionReview(db, user.id, field(form, "groupId"), field(form, "eventId"), field(form, "versionId"),
      field(form, "eventRevision"), field(form, "reviewRevision"), { comment: field(form, "comment"), exercises });
    revalidatePath(await canonicalDestination(db, user.id, `${groupPath(form)}/okter/${field(form, "eventId")}`));
    return { message: "Evalueringen er lagret.", saved: true };
  } catch (error) {
    if (error instanceof DomainError) return { message: error.message, saved: false };
    if (error instanceof ZodError) return { message: error.issues.map((issue) => issue.message).join(" "), saved: false };
    console.error("Evalueringen kunne ikke lagres:", error instanceof Error ? error.name : "Ukjent feil");
    return { message: "Lagringen feilet. Innholdet er beholdt; prøv igjen.", saved: false };
  }
}

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
  if (/^\/(?:grupper|klubber)\/(?!ny(?:[/?]|$))/.test(destination)) {
    try {
      const user = await requireUser();
      destination = await canonicalDestination(await getDatabase(), user.id, destination);
    } catch (error) {
      if (!(error instanceof DomainError || error instanceof ZodError)) throw error;
      destination = `/oversikt?feil=${encodeURIComponent("Klubben eller laget finnes ikke, eller du mangler tilgang.")}`;
    }
  }
  revalidatePath(destination.split("?")[0]);
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
      autoDraftEnabled: form.has("autoDraftEnabled"),
      ...(form.has("generalInstructions") ? { generalInstructions: field(form, "generalInstructions") } : {}),
      ...(form.has("aiPriorities") ? { aiPriorities: JSON.parse(field(form, "aiPriorities")) } : {}),
    });
    return `${groupPath(form)}/innstillinger?melding=${encodeURIComponent("Innstillingene er lagret.")}`;
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

const planningPath = (form: FormData) => {
  const year = yearSchema.safeParse(field(form, "year"));
  const query = new URLSearchParams();
  if (year.success) query.set("year", String(year.data));
  const month = Number(field(form, "month"));
  if (Number.isInteger(month) && month >= 1 && month <= 12) query.set("month", String(month));
  return `${groupPath(form)}/arsplan?${query}`;
};
const eventFields = (form: FormData) => ({
  date: field(form, "date"), startTime: field(form, "startTime"), endTime: field(form, "endTime"),
  title: field(form, "title"), theme: field(form, "theme"), objectives: field(form, "objectives"),
});
const eventPath = (form: FormData) => {
  const eventId = idSchema.safeParse(field(form, "eventId"));
  return eventId.success ? `${groupPath(form)}/okter/${eventId.data}` : groupPath(form);
};

export async function updateNffCurriculum(form: FormData): Promise<{ error: string }> {
  const user = await requireUser();
  try {
    const db = await getDatabase();
    const groupId = idSchema.parse(field(form, "groupId"));
    const year = yearSchema.parse(field(form, "year"));
    const annual = await annualPlanning(db, user.id, groupId, year);
    if (annual.group.birthYear === null) throw new DomainError("Sett årskull i laginnstillingene før du oppdaterer fagplanen.");
    await refreshNffCurriculum(year - annual.group.birthYear);
    const destination = await canonicalDestination(db, user.id, planningPath(form));
    revalidatePath(destination.split("?")[0]);
    return { error: "" };
  } catch (error) {
    if (error instanceof DomainError) return { error: error.message };
    console.error("Fagplanoppdatering feilet:", error instanceof Error ? error.name : "Ukjent feil");
    return { error: "Fagplanen kunne ikke oppdateres. Sist lagrede fagplan er beholdt. Kontroller AI-oppsettet og prøv igjen." };
  }
}

export async function saveYearPlan(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form), async () => {
    await saveAnnualPlan(await getDatabase(), user.id, field(form, "groupId"), {
      year: field(form, "year"), objectives: field(form, "objectives"),
    }, field(form, "revision"));
    return `${planningPath(form)}&melding=${encodeURIComponent("Årsplanen er lagret.")}`;
  });
}

export async function saveThemePeriod(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form), async () => {
    await savePlanPeriod(await getDatabase(), user.id, field(form, "groupId"), yearSchema.parse(field(form, "year")), {
      startDate: field(form, "startDate"), endDate: field(form, "endDate"), theme: field(form, "theme"),
      objectives: field(form, "objectives"), coachMoments: field(form, "coachMoments"), progression: field(form, "progression"), sourceUrl: field(form, "sourceUrl"),
    }, field(form, "revision"), field(form, "periodId") || undefined, true);
    return `${planningPath(form)}&melding=${encodeURIComponent("Temaperioden er lagret. Eksisterende øktplaner er ikke endret.")}`;
  });
}

export async function deleteThemePeriod(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form), async () => {
    await removePlanPeriod(await getDatabase(), user.id, field(form, "groupId"), field(form, "periodId"), field(form, "revision"));
    return `${planningPath(form)}&melding=${encodeURIComponent("Perioden er fjernet. Lagrede planversjoner beholdes.")}`;
  });
}

export async function unlockMonthTheme(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form), async () => {
    await unlockPlanMonth(await getDatabase(), user.id, field(form, "groupId"), field(form, "periodId"), field(form, "month"), field(form, "revision"));
    return `${planningPath(form)}&melding=${encodeURIComponent("Temaet er låst opp for måneden. Eksisterende øktplaner er beholdt.")}`;
  });
}

export async function newTrainingEvent(form: FormData) {
  const user = await requireUser();
  const month = Number(field(form, "month"));
  const year = yearSchema.safeParse(field(form, "year"));
  const singlePath = `${groupPath(form)}/okter/ny${year.success && Number.isInteger(month) && month >= 1 && month <= 12 ? `?year=${year.data}&month=${month}` : ""}`;
  return run(field(form, "singleSession") === "1" ? singlePath : planningPath(form), async () => {
    const singleSession = field(form, "singleSession") === "1";
    if (field(form, "intent") === "lock-focus" && (!field(form, "theme").trim() || !field(form, "objectives").trim())) {
      throw new DomainError("Velg et hovedtema og øvingsmål før du låser øktfokuset.");
    }
    const eventId = await createTrainingEvent(await getDatabase(), user.id, field(form, "groupId"),
      eventFields(form), field(form, "recurrenceKey") || null, field(form, "intent") === "cancel", singleSession ? field(form, "coachInput") : "",
      singleSession ? form.getAll("coachIds") : undefined);
    if (field(form, "intent") === "lock-focus") return `${planningPath(form)}&melding=${encodeURIComponent("Øktfokuset er låst. Åpne øktplanen for å planlegge øvelsene.")}`;
    return `${groupPath(form)}/okter/${eventId}${singleSession || field(form, "intent") === "create" ? "?initialDraft=1" : ""}`;
  });
}

export async function lockTrainingFocus(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form), async () => {
    await saveSessionFocus(await getDatabase(), user.id, field(form, "groupId"), field(form, "eventId"), field(form, "revision"),
      { theme: field(form, "theme"), objectives: field(form, "objectives") });
    return `${planningPath(form)}&melding=${encodeURIComponent("Øktfokuset er låst. Eksisterende øvelser er beholdt.")}`;
  });
}

export async function saveYearEvent(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form), async () => {
    await saveAnnualEvent(await getDatabase(), user.id, field(form, "groupId"), {
      title: field(form, "title"), kind: field(form, "kind"), startDate: field(form, "startDate"),
      endDate: field(form, "endDate"), description: field(form, "description"),
    }, field(form, "annualEventId") || undefined, field(form, "revision"));
    return `${planningPath(form)}&melding=${encodeURIComponent("Hendelsen er lagret. Treninger er ikke avlyst automatisk.")}`;
  });
}

export async function deleteYearEvent(form: FormData) {
  const user = await requireUser();
  return run(planningPath(form), async () => {
    await removeAnnualEvent(await getDatabase(), user.id, field(form, "groupId"), field(form, "annualEventId"), field(form, "revision"));
    return `${planningPath(form)}&melding=${encodeURIComponent("Hendelsen er fjernet. Treninger og lagrede øktversjoner er uendret.")}`;
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
      eventFields(form), plan, field(form, "revision"), "planned",
      field(form, "origin") === "ai" ? "ai" : "manual", false);
  } catch (error) {
    if (error instanceof ZodError) return { error: error.issues.map((issue) => issue.message).join(" ") };
    if (error instanceof DomainError) return { error: error.message };
    console.error("Øktplanen kunne ikke lagres:", error);
    return { error: "Lagring feilet. Kontroller serverloggen og prøv igjen. Endringene er beholdt i skjemaet." };
  }
  const destination = await canonicalDestination(await getDatabase(), user.id, `${eventPath(form)}?melding=${encodeURIComponent("Ny planversjon er lagret.")}`);
  revalidatePath(destination.split("?")[0]);
  redirect(destination);
}

export async function setTrainingStatus(form: FormData) {
  const user = await requireUser();
  return run(eventPath(form), async () => {
    await setTrainingCancellation(await getDatabase(), user.id, field(form, "groupId"), field(form, "eventId"),
      field(form, "revision"), field(form, "intent") === "cancel");
    return `${eventPath(form)}?melding=${encodeURIComponent("Avlysningsstatusen er oppdatert. Øktplanen er uendret.")}`;
  });
}

export async function deleteSessionPlanAction(form: FormData) {
  const user = await requireUser();
  return run(eventPath(form), async () => {
    await deleteSessionPlan(await getDatabase(), user.id, field(form, "groupId"), field(form, "eventId"), field(form, "revision"));
    return `${eventPath(form)}?melding=${encodeURIComponent("Øktplanen er slettet. Treningen og tidligere revisjoner er bevart.")}`;
  });
}
