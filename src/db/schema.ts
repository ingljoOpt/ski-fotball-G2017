import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, boolean, date, jsonb,
  primaryKey, unique, foreignKey, check, index,
} from "drizzle-orm/pg-core";
import type { PlanningSnapshot, SessionPlan } from "../lib/planning.ts";
import type { SessionReview } from "../lib/session-review.ts";
import { DEFAULT_ACCENT, DEFAULT_PRIMARY } from "../lib/branding.ts";
import { defaultPlanningPriorities, type PlanningPriority } from "../lib/planning-priorities.ts";
import { defaultDifferentiation, type Differentiation } from "../lib/differentiation.ts";

export const groupRole = pgEnum("group_role", ["head_coach", "coach"]);
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});

export const customExercises = pgTable("custom_exercises", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  theme: text("theme").notNull().default(""),
  themeSource: text("theme_source").notNull().default(""),
  objectives: text("objectives").notNull().default(""),
  ageMin: integer("age_min").notNull(),
  ageMax: integer("age_max").notNull(),
  videoUrl: text("video_url").notNull().default(""),
  animations: jsonb("animations").$type<unknown[]>().notNull().default([]),
  revision: integer("revision").notNull().default(1),
  createdAt: createdAt(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  check("custom_exercise_age_range", sql`${table.ageMin} >= 3 and ${table.ageMax} <= 100 and ${table.ageMin} <= ${table.ageMax}`),
]);

export const annualPlans = pgTable("annual_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  year: integer("year").notNull(),
  legacyBirthYear: integer("birth_year"),
  objectives: text("objectives").notNull().default(""),
  revision: integer("revision").notNull().default(1),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  unique("annual_plan_group_year").on(table.groupId, table.year),
  unique("annual_plan_tenant_id").on(table.clubId, table.groupId, table.id),
  check("annual_plan_year_range", sql`${table.year} between 2000 and 2100`),
]);

export const planPeriods = pgTable("plan_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  annualPlanId: uuid("annual_plan_id").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  theme: text("theme").notNull(),
  objectives: text("objectives").notNull(),
  coachMoments: text("coach_moments").notNull().default(""),
  progression: text("progression").notNull().default(""),
  sourceUrl: text("source_url").notNull().default(""),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId, table.annualPlanId],
    foreignColumns: [annualPlans.clubId, annualPlans.groupId, annualPlans.id] }).onDelete("cascade"),
  check("period_date_order", sql`${table.endDate} >= ${table.startDate}`),
]);

export const trainingEvents = pgTable("training_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  durationMinutes: integer("duration_minutes").notNull(),
  title: text("title").notNull(),
  theme: text("theme").notNull().default(""),
  objectives: text("objectives").notNull().default(""),
  recurrenceKey: text("recurrence_key"),
  coachInput: text("coach_input").notNull().default(""),
  status: text("status", { enum: ["draft", "planned"] }).notNull().default("draft"),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  planDeletedAt: timestamp("plan_deleted_at", { withTimezone: true }),
  revision: integer("revision").notNull().default(1),
  createdAt: createdAt(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  unique("event_tenant_id").on(table.clubId, table.groupId, table.id),
  unique("event_group_slot").on(table.groupId, table.date, table.startTime),
  unique("event_recurrence_key").on(table.groupId, table.recurrenceKey),
  check("event_duration_range", sql`${table.durationMinutes} between 15 and 240`),
  check("event_status", sql`${table.status} in ('draft', 'planned')`),
  check("event_time", sql`${table.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  check("event_end_time", sql`${table.endTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  check("event_time_duration", sql`${table.durationMinutes} = mod((extract(epoch from ${table.endTime}::time)::integer - extract(epoch from ${table.startTime}::time)::integer + 86400), 86400) / 60`),
]);

export const sessionVersions = pgTable("session_versions", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  eventId: uuid("event_id").notNull(),
  version: integer("version").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  origin: text("origin", { enum: ["manual", "ai"] }).notNull(),
  eventSnapshot: jsonb("event_snapshot").$type<{ date: string; startTime: string; endTime: string; durationMinutes: number; title: string; theme: string; objectives: string; status: "draft" | "planned" }>().notNull(),
  plan: jsonb("plan").$type<SessionPlan>().notNull(),
  planningContext: jsonb("planning_context").$type<PlanningSnapshot>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId, table.eventId],
    foreignColumns: [trainingEvents.clubId, trainingEvents.groupId, trainingEvents.id] }).onDelete("cascade"),
  unique("session_version_number").on(table.eventId, table.version),
  unique("session_version_event_id_unique").on(table.eventId, table.id),
  check("session_origin", sql`${table.origin} in ('manual', 'ai')`),
]);

export const sessionReviews = pgTable("session_reviews", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  eventId: uuid("event_id").notNull(),
  versionId: uuid("version_id").notNull(),
  authorId: uuid("author_id").notNull().references(() => users.id),
  review: jsonb("review").$type<SessionReview>().notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId, table.eventId],
    foreignColumns: [trainingEvents.clubId, trainingEvents.groupId, trainingEvents.id] }).onDelete("cascade"),
  foreignKey({ columns: [table.eventId, table.versionId], foreignColumns: [sessionVersions.eventId, sessionVersions.id] }).onDelete("cascade"),
  unique("session_review_author").on(table.eventId, table.authorId),
  check("session_review_revision", sql`${table.revision} > 0`),
]);

export const loginLinks = pgTable("login_links", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  returnPath: text("return_path").notNull().default("/oversikt"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const annualEvents = pgTable("annual_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  title: text("title").notNull(),
  kind: text("kind", { enum: ["cup", "holiday", "other"] }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  description: text("description").notNull().default(""),
  revision: integer("revision").notNull().default(1),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  check("annual_event_date_order", sql`${table.endDate} >= ${table.startDate}`),
  check("annual_event_kind", sql`${table.kind} in ('cup', 'holiday', 'other')`),
]);

export const planningHistory = pgTable("planning_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  planYear: integer("plan_year").notNull(),
  entityType: text("entity_type", { enum: ["session", "annual_plan", "plan_period"] }).notNull(),
  entityId: uuid("entity_id").notNull(),
  parentId: uuid("parent_id"),
  action: text("action", { enum: ["created", "updated", "deleted", "status_changed"] }).notNull(),
  actorType: text("actor_type", { enum: ["user", "ai", "system"] }).notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  beforeSnapshot: jsonb("before_snapshot").$type<Record<string, unknown> | null>(),
  afterSnapshot: jsonb("after_snapshot").$type<Record<string, unknown> | null>(),
  createdAt: createdAt(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  check("planning_history_year_range", sql`${table.planYear} between 2000 and 2100`),
  check("planning_history_entity_type", sql`${table.entityType} in ('session', 'annual_plan', 'plan_period')`),
  check("planning_history_action", sql`${table.action} in ('created', 'updated', 'deleted', 'status_changed')`),
  check("planning_history_actor_type", sql`${table.actorType} in ('user', 'ai', 'system')`),
  index("planning_history_entity_idx").on(table.groupId, table.entityType, table.entityId, table.createdAt),
  index("planning_history_year_idx").on(table.groupId, table.planYear, table.createdAt),
]);

export const authSessions = pgTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const clubs = pgTable("clubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  primaryColor: text("primary_color").notNull().default(DEFAULT_PRIMARY),
  accentColor: text("accent_color").notNull().default(DEFAULT_ACCENT),
  logoData: text("logo_data"),
  createdAt: createdAt(),
}, (table) => [
  check("club_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${table.slug}) <= 120`),
]);

export const clubAdmins = pgTable("club_admins", {
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.clubId, table.userId] })]);

export const clubDocuments = pgTable("club_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  mediaType: text("media_type").notNull(),
  data: text("data").notNull(),
  extractedText: text("extracted_text").notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: createdAt(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
}, (table) => [index("club_documents_club_idx").on(table.clubId)]);

export const clubInvitations = pgTable("club_invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  invitedBy: uuid("invited_by").notNull().references(() => users.id),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const groups = pgTable("groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  birthYear: integer("birth_year"),
  playerCount: integer("player_count"),
  coachCount: integer("coach_count"),
  differentiation: jsonb("differentiation").$type<Differentiation>().notNull().default(defaultDifferentiation),
  // Retained only to migrate existing weekly times without discarding the old duration.
  legacyDurationMinutes: integer("duration_minutes").notNull().default(60),
  generationDaysBefore: integer("generation_days_before").notNull().default(3),
  autoDraftEnabled: boolean("auto_draft_enabled").notNull().default(false),
  generalInstructions: text("general_instructions").notNull().default(""),
  aiPriorities: jsonb("ai_priorities").$type<PlanningPriority[]>().notNull().default(defaultPlanningPriorities),
  createdAt: createdAt(),
}, (table) => [
  unique("groups_club_slug_unique").on(table.clubId, table.slug),
  check("team_slug_format", sql`${table.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(${table.slug}) <= 120`),
  unique("groups_club_id_id_unique").on(table.clubId, table.id),
  check("duration_range", sql`${table.legacyDurationMinutes} between 15 and 240`),
  check("generation_days_range", sql`${table.generationDaysBefore} between 0 and 30`),
  check("group_birth_year_range", sql`${table.birthYear} between 1900 and 2100`),
]);

export const groupMembers = pgTable("group_members", {
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: groupRole("role").notNull(),
}, (table) => [
  primaryKey({ columns: [table.groupId, table.userId] }),
  foreignKey({
    columns: [table.clubId, table.groupId],
    foreignColumns: [groups.clubId, groups.id],
  }).onDelete("cascade"),
]);

export const coaches = pgTable("coaches", {
  id: uuid("id").defaultRandom().notNull(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
}, (table) => [
  primaryKey({ columns: [table.groupId, table.id] }),
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  unique("coach_group_email").on(table.groupId, table.email),
  unique("coach_group_user").on(table.groupId, table.userId),
  check("coach_name_length", sql`length(trim(${table.name})) between 2 and 254`),
  check("coach_user_email", sql`${table.userId} is null or ${table.email} is not null`),
]);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  email: text("email").notNull(),
  role: groupRole("role").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: createdAt(),
}, (table) => [
  foreignKey({
    columns: [table.clubId, table.groupId],
    foreignColumns: [groups.clubId, groups.id],
  }).onDelete("cascade"),
]);

export const trainingTimes = pgTable("training_times", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  weekday: integer("weekday").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  expectedPlayers: integer("expected_players"),
  expectedCoaches: integer("expected_coaches"),
  timezone: text("timezone").notNull().default("Europe/Oslo"),
  enabled: boolean("enabled").notNull().default(true),
}, (table) => [
  foreignKey({
    columns: [table.clubId, table.groupId],
    foreignColumns: [groups.clubId, groups.id],
  }).onDelete("cascade"),
  unique("training_times_slot").on(table.groupId, table.weekday, table.startTime),
  check("weekday_range", sql`${table.weekday} between 1 and 7`),
  check("time_format", sql`${table.startTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  check("training_end_time", sql`${table.endTime} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  check("training_time_duration", sql`mod((extract(epoch from ${table.endTime}::time)::integer - extract(epoch from ${table.startTime}::time)::integer + 86400), 86400) / 60 between 15 and 240`),
]);

export const generationJobs = pgTable("generation_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  date: date("date").notNull(),
  startTime: text("start_time").notNull(),
  status: text("status", { enum: ["running", "failed", "completed"] }).notNull(),
  leaseToken: uuid("lease_token").notNull(),
  leaseUntil: timestamp("lease_until", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  unique("generation_job_slot").on(table.groupId, table.date, table.startTime),
  check("generation_job_status", sql`${table.status} in ('running', 'failed', 'completed')`),
]);
