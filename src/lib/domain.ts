import { randomBytes, createHash } from "node:crypto";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../db/index.ts";
import {
  authSessions, clubAdmins, clubInvitations, clubs, groupMembers, groups,
  invitations, loginLinks, trainingTimes, users,
} from "../db/schema.ts";
import { emailSchema, idSchema, nameSchema, safeReturnPath, settingsSchema, tokenSchema, trainingTimeSchema } from "./validation.ts";
import { brandingSchema, DEFAULT_ACCENT, DEFAULT_PRIMARY } from "./branding.ts";
import { normalizeLogo } from "./logo.ts";

export class DomainError extends Error {}
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const newToken = () => randomBytes(32).toString("hex");
const expiresIn = (days: number) => new Date(Date.now() + days * 86_400_000);

export async function createLoginLink(db: Database, email: string, returnPath?: string) {
  const token = newToken();
  await db.insert(loginLinks).values({
    email: emailSchema.parse(email),
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + 15 * 60_000),
    returnPath: safeReturnPath(returnPath),
  });
  return token;
}

export async function consumeLoginLink(db: Database, token: string) {
  tokenSchema.parse(token);
  return db.transaction(async (tx) => {
    const [link] = await tx.delete(loginLinks).where(and(
      eq(loginLinks.tokenHash, hashToken(token)), gt(loginLinks.expiresAt, new Date()),
    )).returning();
    if (!link) throw new DomainError("Innloggingslenken er brukt eller utløpt. Be om en ny.");
    const [user] = await tx.insert(users).values({ email: link.email })
      .onConflictDoUpdate({ target: users.email, set: { email: link.email } }).returning();
    const sessionToken = newToken();
    const expiresAt = expiresIn(30);
    await tx.insert(authSessions).values({ tokenHash: hashToken(sessionToken), userId: user.id, expiresAt });
    return { sessionToken, expiresAt, returnPath: link.returnPath };
  });
}

export async function userForSession(db: Database, token: string) {
  if (!tokenSchema.safeParse(token).success) return null;
  const [result] = await db.select({ user: users }).from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.tokenHash, hashToken(token)), gt(authSessions.expiresAt, new Date())));
  return result?.user ?? null;
}

export async function revokeSession(db: Database, token: string) {
  await db.delete(authSessions).where(eq(authSessions.tokenHash, hashToken(token)));
}

export async function requireClubAdmin(db: Database, userId: string, clubId: string) {
  idSchema.parse(clubId);
  const [admin] = await db.select().from(clubAdmins).where(and(
    eq(clubAdmins.clubId, clubId), eq(clubAdmins.userId, userId),
  ));
  if (!admin) throw new DomainError("Du har ikke administratortilgang til denne klubben.");
}

export async function getGroupAccess(db: Database, userId: string, groupId: string) {
  idSchema.parse(groupId);
  const [result] = await db.select({
    group: groups,
    isAdmin: sql<boolean>`${clubAdmins.userId} is not null`,
    role: groupMembers.role,
  }).from(groups)
    .leftJoin(clubAdmins, and(eq(clubAdmins.clubId, groups.clubId), eq(clubAdmins.userId, userId)))
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId)))
    .where(and(eq(groups.id, groupId), sql`(${clubAdmins.userId} is not null or ${groupMembers.userId} is not null)`));
  if (!result) throw new DomainError("Gruppen finnes ikke, eller du mangler tilgang.");
  return { ...result, canManage: result.isAdmin || result.role === "head_coach" };
}

export async function requireGroupManager(db: Database, userId: string, groupId: string) {
  const access = await getGroupAccess(db, userId, groupId);
  if (!access.canManage) throw new DomainError("Bare hovedtrener eller klubbadministrator kan administrere gruppen.");
  return access;
}

export async function createClub(db: Database, userId: string, name: string) {
  const cleanName = nameSchema.parse(name);
  return db.transaction(async (tx) => {
    const [club] = await tx.insert(clubs).values({ name: cleanName, primaryColor: DEFAULT_PRIMARY, accentColor: DEFAULT_ACCENT }).returning();
    await tx.insert(clubAdmins).values({ clubId: club.id, userId });
    return club;
  });
}

export async function updateClubBranding(
  db: Database, userId: string, clubId: string, input: unknown, logo: File | null, removeLogo = false,
) {
  await requireClubAdmin(db, userId, clubId);
  const colors = brandingSchema.parse(input);
  if (logo && removeLogo) throw new DomainError("Velg enten ny logo eller fjern logo, ikke begge samtidig.");
  const logoData = logo ? await normalizeLogo(logo) : removeLogo ? null : undefined;
  await db.transaction(async (tx) => {
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId)).for("update");
    await requireClubAdmin(tx, userId, clubId);
    await tx.update(clubs).set({ ...colors, ...(logoData !== undefined ? { logoData } : {}) }).where(eq(clubs.id, clubId));
  });
}

export async function resetClubBranding(db: Database, userId: string, clubId: string) {
  await updateClubBranding(db, userId, clubId, { primaryColor: DEFAULT_PRIMARY, accentColor: DEFAULT_ACCENT }, null, true);
}

export async function clubAdministration(db: Database, userId: string, clubId: string) {
  await requireClubAdmin(db, userId, clubId);
  const [admins, pending] = await Promise.all([
    db.select({ userId: users.id, email: users.email }).from(clubAdmins)
      .innerJoin(users, eq(users.id, clubAdmins.userId))
      .where(eq(clubAdmins.clubId, clubId)).orderBy(users.email),
    db.select({ id: clubInvitations.id, email: clubInvitations.email }).from(clubInvitations)
      .where(and(eq(clubInvitations.clubId, clubId), isNull(clubInvitations.acceptedAt),
        gt(clubInvitations.expiresAt, new Date()))).orderBy(clubInvitations.createdAt),
  ]);
  return { admins, pending };
}

export async function inviteClubAdmin(db: Database, userId: string, clubId: string, email: string) {
  idSchema.parse(clubId);
  const cleanEmail = emailSchema.parse(email);
  return db.transaction(async (tx) => {
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId)).for("update");
    await requireClubAdmin(tx, userId, clubId);
    const [existing] = await tx.select({ id: users.id }).from(clubAdmins)
      .innerJoin(users, eq(users.id, clubAdmins.userId))
      .where(and(eq(clubAdmins.clubId, clubId), eq(users.email, cleanEmail)));
    if (existing) throw new DomainError("Denne brukeren er allerede klubbadministrator.");
    await tx.delete(clubInvitations).where(and(
      eq(clubInvitations.clubId, clubId), eq(clubInvitations.email, cleanEmail), isNull(clubInvitations.acceptedAt),
    ));
    const token = newToken();
    await tx.insert(clubInvitations).values({
      clubId, invitedBy: userId, email: cleanEmail, tokenHash: hashToken(token), expiresAt: expiresIn(7),
    });
    return { token, email: cleanEmail };
  });
}

export async function acceptClubInvitation(db: Database, userId: string, token: string) {
  tokenSchema.parse(token);
  return db.transaction(async (tx) => {
    const [candidate] = await tx.select({ clubId: clubInvitations.clubId }).from(clubInvitations)
      .where(eq(clubInvitations.tokenHash, hashToken(token)));
    if (!candidate) throw new DomainError("Klubbinvitasjonen er ugyldig eller tilbakekalt.");
    // Serialize all administrator changes on the club, including concurrent removals.
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, candidate.clubId)).for("update");
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new DomainError("Brukeren finnes ikke.");
    const [invitation] = await tx.update(clubInvitations).set({ acceptedAt: new Date() }).where(and(
      eq(clubInvitations.tokenHash, hashToken(token)), eq(clubInvitations.email, user.email),
      isNull(clubInvitations.acceptedAt), gt(clubInvitations.expiresAt, new Date()),
    )).returning();
    if (!invitation) throw new DomainError("Klubbinvitasjonen er utløpt, allerede brukt eller tilhører en annen e-postadresse.");
    await requireClubAdmin(tx, invitation.invitedBy, invitation.clubId);
    await tx.insert(clubAdmins).values({ clubId: invitation.clubId, userId }).onConflictDoNothing();
    return invitation.clubId;
  });
}

export async function cancelClubInvitation(db: Database, userId: string, clubId: string, invitationId: string) {
  idSchema.parse(clubId);
  idSchema.parse(invitationId);
  await db.transaction(async (tx) => {
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId)).for("update");
    await requireClubAdmin(tx, userId, clubId);
    const [removed] = await tx.delete(clubInvitations).where(and(
      eq(clubInvitations.clubId, clubId), eq(clubInvitations.id, invitationId), isNull(clubInvitations.acceptedAt),
    )).returning();
    if (!removed) throw new DomainError("Invitasjonen finnes ikke eller er allerede akseptert.");
  });
}

export async function removeClubAdmin(db: Database, userId: string, clubId: string, targetUserId: string) {
  idSchema.parse(clubId);
  idSchema.parse(targetUserId);
  await db.transaction(async (tx) => {
    await tx.select({ id: clubs.id }).from(clubs).where(eq(clubs.id, clubId)).for("update");
    await requireClubAdmin(tx, userId, clubId);
    const admins = await tx.select().from(clubAdmins).where(eq(clubAdmins.clubId, clubId));
    if (!admins.some((admin) => admin.userId === targetUserId)) throw new DomainError("Brukeren er ikke administrator i denne klubben.");
    if (admins.length <= 1) throw new DomainError("Klubben må ha minst én administrator. Inviter en ny før du fjerner den siste.");
    await tx.delete(clubAdmins).where(and(eq(clubAdmins.clubId, clubId), eq(clubAdmins.userId, targetUserId)));
    await tx.delete(clubInvitations).where(and(
      eq(clubInvitations.clubId, clubId), isNull(clubInvitations.acceptedAt),
      or(eq(clubInvitations.invitedBy, targetUserId),
        sql`${clubInvitations.email} = (select ${users.email} from ${users} where ${users.id} = ${targetUserId})`),
    ));
  });
}

export async function transferHeadCoach(db: Database, userId: string, groupId: string, targetUserId: string) {
  idSchema.parse(groupId);
  idSchema.parse(targetUserId);
  await db.transaction(async (tx) => {
    const [group] = await tx.select().from(groups).where(eq(groups.id, groupId)).for("update");
    if (!group) throw new DomainError("Gruppen finnes ikke, eller du mangler tilgang.");
    await requireClubAdmin(tx, userId, group.clubId);
    const [member] = await tx.select().from(groupMembers).where(and(
      eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId),
    ));
    if (!member) throw new DomainError("Ny hovedtrener må være et aktivt medlem av denne gruppen.");
    if (member.role === "head_coach") throw new DomainError("Medlemmet er allerede hovedtrener.");
    await tx.update(groupMembers).set({ role: "coach" }).where(and(
      eq(groupMembers.groupId, groupId), eq(groupMembers.role, "head_coach"),
    ));
    await tx.update(groupMembers).set({ role: "head_coach" }).where(and(
      eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId),
    ));
    // Old head-coach invitations must not restore the superseded role.
    await tx.delete(invitations).where(and(
      eq(invitations.groupId, groupId), eq(invitations.role, "head_coach"), isNull(invitations.acceptedAt),
    ));
  });
}

export async function listClubs(db: Database, userId: string) {
  return db.select({
    id: clubs.id, name: clubs.name,
    primaryColor: clubs.primaryColor, accentColor: clubs.accentColor, logoData: clubs.logoData,
    isAdmin: sql<boolean>`${clubAdmins.userId} is not null`,
  }).from(clubs)
    .leftJoin(clubAdmins, and(eq(clubAdmins.clubId, clubs.id), eq(clubAdmins.userId, userId)))
    .where(sql`${clubAdmins.userId} is not null or exists (
      select 1 from ${groupMembers} where ${groupMembers.clubId} = ${clubs.id} and ${groupMembers.userId} = ${userId}
    )`).orderBy(clubs.name);
}

export async function listClubGroups(db: Database, userId: string, clubId: string) {
  idSchema.parse(clubId);
  const visibleClubs = await listClubs(db, userId);
  const club = visibleClubs.find((item) => item.id === clubId);
  if (!club) throw new DomainError("Klubben finnes ikke, eller du mangler tilgang.");
  const visibleGroups = await db.select({ group: groups }).from(groups)
    .leftJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId)))
    .where(and(eq(groups.clubId, clubId), club.isAdmin ? undefined : eq(groupMembers.userId, userId)))
    .orderBy(groups.name);
  return { club, groups: visibleGroups.map((item) => item.group) };
}

export async function createGroup(db: Database, userId: string, clubId: string, name: string, headCoachEmail: string) {
  await requireClubAdmin(db, userId, clubId);
  const cleanName = nameSchema.parse(name);
  const email = emailSchema.parse(headCoachEmail);
  const token = newToken();
  return db.transaction(async (tx) => {
    const [group] = await tx.insert(groups).values({ clubId, name: cleanName }).returning();
    await tx.insert(invitations).values({
      clubId, groupId: group.id, email, role: "head_coach",
      tokenHash: hashToken(token), expiresAt: expiresIn(7),
    });
    return { group, token, email };
  });
}

export async function inviteCoach(db: Database, userId: string, groupId: string, email: string) {
  const { group } = await requireGroupManager(db, userId, groupId);
  const token = newToken();
  const cleanEmail = emailSchema.parse(email);
  await db.insert(invitations).values({
    clubId: group.clubId, groupId, email: cleanEmail, role: "coach",
    tokenHash: hashToken(token), expiresAt: expiresIn(7),
  });
  return { token, email: cleanEmail };
}

export async function acceptInvitation(db: Database, userId: string, token: string) {
  tokenSchema.parse(token);
  return db.transaction(async (tx) => {
    const [candidate] = await tx.select({ groupId: invitations.groupId }).from(invitations)
      .where(eq(invitations.tokenHash, hashToken(token)));
    if (!candidate) throw new DomainError("Invitasjonen er ugyldig eller tilbakekalt.");
    await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, candidate.groupId)).for("update");
    const [user] = await tx.select().from(users).where(eq(users.id, userId));
    if (!user) throw new DomainError("Brukeren finnes ikke.");
    const [invitation] = await tx.update(invitations).set({ acceptedAt: new Date() }).where(and(
      eq(invitations.tokenHash, hashToken(token)), eq(invitations.email, user.email),
      isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()),
    )).returning();
    if (!invitation) throw new DomainError("Invitasjonen er utløpt, allerede brukt eller tilhører en annen e-postadresse.");
    if (invitation.role === "coach") {
      const [headCoach] = await tx.select({ userId: groupMembers.userId }).from(groupMembers)
        .where(and(eq(groupMembers.groupId, invitation.groupId), eq(groupMembers.role, "head_coach"))).limit(1);
      if (!headCoach) throw new DomainError("Hovedtrener må bli med i gruppen før øvrige trenere.");
    }
    await tx.insert(groupMembers).values({
      clubId: invitation.clubId, groupId: invitation.groupId, userId, role: invitation.role,
    }).onConflictDoNothing();
    return invitation.groupId;
  });
}

export async function removeMember(db: Database, userId: string, groupId: string, targetUserId: string) {
  idSchema.parse(groupId);
  idSchema.parse(targetUserId);
  await db.transaction(async (tx) => {
    await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, groupId)).for("update");
    const access = await requireGroupManager(tx, userId, groupId);
    const conditions = [eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId)];
    if (!access.isAdmin) conditions.push(eq(groupMembers.role, "coach"));
    const [removed] = await tx.delete(groupMembers).where(and(...conditions)).returning();
    if (!removed) throw new DomainError("Medlemmet finnes ikke, eller bare klubbadministrator kan fjerne denne rollen.");
    // Pending invitations must not restore a removed member's access.
    await tx.delete(invitations).where(and(
      eq(invitations.groupId, groupId), isNull(invitations.acceptedAt),
      sql`${invitations.email} = (select ${users.email} from ${users} where ${users.id} = ${targetUserId})`,
    ));
  });
}

export async function updateGroupSettings(db: Database, userId: string, groupId: string, input: unknown) {
  await requireGroupManager(db, userId, groupId);
  const settings = settingsSchema.parse(input);
  await db.update(groups).set(settings).where(eq(groups.id, groupId));
}

export async function addTrainingTime(db: Database, userId: string, groupId: string, input: unknown) {
  const { group } = await requireGroupManager(db, userId, groupId);
  const time = trainingTimeSchema.parse(input);
  const [created] = await db.insert(trainingTimes).values({ clubId: group.clubId, groupId, ...time })
    .onConflictDoNothing({ target: [trainingTimes.groupId, trainingTimes.weekday, trainingTimes.startTime] }).returning();
  if (!created) throw new DomainError("Denne treningstiden er allerede registrert.");
}

export async function removeTrainingTime(db: Database, userId: string, groupId: string, timeId: string) {
  await requireGroupManager(db, userId, groupId);
  idSchema.parse(timeId);
  const [removed] = await db.delete(trainingTimes).where(and(
    eq(trainingTimes.groupId, groupId), eq(trainingTimes.id, timeId),
  )).returning();
  if (!removed) throw new DomainError("Treningstiden finnes ikke i denne gruppen.");
}

export async function groupDetails(db: Database, userId: string, groupId: string) {
  const access = await getGroupAccess(db, userId, groupId);
  const [members, times, pending, [club]] = await Promise.all([
    db.select({ userId: users.id, email: users.email, role: groupMembers.role }).from(groupMembers)
      .innerJoin(users, eq(users.id, groupMembers.userId)).where(eq(groupMembers.groupId, groupId)).orderBy(users.email),
    db.select().from(trainingTimes).where(eq(trainingTimes.groupId, groupId)).orderBy(trainingTimes.weekday, trainingTimes.startTime),
    access.canManage ? db.select({ id: invitations.id, email: invitations.email, role: invitations.role })
      .from(invitations).where(and(eq(invitations.groupId, groupId),
        isNull(invitations.acceptedAt), gt(invitations.expiresAt, new Date()))) : Promise.resolve([]),
    db.select().from(clubs).where(eq(clubs.id, access.group.clubId)),
  ]);
  return { ...access, members, times, pending, club };
}
