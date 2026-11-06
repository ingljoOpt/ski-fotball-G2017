import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, boolean, date, jsonb,
  primaryKey, unique, foreignKey, check,
} from "drizzle-orm/pg-core";
import type { PlanningSnapshot, SessionPlan } from "../lib/planning.ts";
import { DEFAULT_ACCENT, DEFAULT_PRIMARY } from "../lib/branding.ts";

export const groupRole = pgEnum("group_role", ["head_coach", "coach"]);
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});

export const annualPlans = pgTable("annual_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  clubId: uuid("club_id").notNull(),
  groupId: uuid("group_id").notNull(),
  year: integer("year").notNull(),
  birthYear: integer("birth_year"),
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
  status: text("status", { enum: ["draft", "planned", "cancelled"] }).notNull().default("draft"),
  revision: integer("revision").notNull().default(1),
  createdAt: createdAt(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId], foreignColumns: [groups.clubId, groups.id] }).onDelete("cascade"),
  unique("event_tenant_id").on(table.clubId, table.groupId, table.id),
  unique("event_group_slot").on(table.groupId, table.date, table.startTime),
  unique("event_recurrence_key").on(table.groupId, table.recurrenceKey),
  check("event_duration_range", sql`${table.durationMinutes} between 15 and 240`),
  check("event_status", sql`${table.status} in ('draft', 'planned', 'cancelled')`),
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
  createdBy: uuid("created_by").notNull().references(() => users.id),
  origin: text("origin", { enum: ["manual", "ai"] }).notNull(),
  eventSnapshot: jsonb("event_snapshot").$type<{ date: string; startTime: string; endTime: string; durationMinutes: number; title: string; theme: string; objectives: string; status: "draft" | "planned" }>().notNull(),
  plan: jsonb("plan").$type<SessionPlan>().notNull(),
  planningContext: jsonb("planning_context").$type<PlanningSnapshot>().notNull(),
  createdAt: createdAt(),
}, (table) => [
  foreignKey({ columns: [table.clubId, table.groupId, table.eventId],
    foreignColumns: [trainingEvents.clubId, trainingEvents.groupId, trainingEvents.id] }).onDelete("cascade"),
  unique("session_version_number").on(table.eventId, table.version),
  check("session_origin", sql`${table.origin} in ('manual', 'ai')`),
]);

export const loginLinks = pgTable("login_links", {
  tokenHash: text("token_hash").primaryKey(),
  email: text("email").notNull(),
  returnPath: text("return_path").notNull().default("/oversikt"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const authSessions = pgTable("auth_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const clubs = pgTable("clubs", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  primaryColor: text("primary_color").notNull().default(DEFAULT_PRIMARY),
  accentColor: text("accent_color").notNull().default(DEFAULT_ACCENT),
  logoData: text("logo_data"),
  createdAt: createdAt(),
});

export const clubAdmins = pgTable("club_admins", {
  clubId: uuid("club_id").notNull().references(() => clubs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
}, (table) => [primaryKey({ columns: [table.clubId, table.userId] })]);

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
  // Retained only to migrate existing weekly times without discarding the old duration.
  legacyDurationMinutes: integer("duration_minutes").notNull().default(60),
  generationDaysBefore: integer("generation_days_before").notNull().default(3),
  createdAt: createdAt(),
}, (table) => [
  unique("groups_club_id_id_unique").on(table.clubId, table.id),
  check("duration_range", sql`${table.legacyDurationMinutes} between 15 and 240`),
  check("generation_days_range", sql`${table.generationDaysBefore} between 0 and 30`),
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
