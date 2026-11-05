import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, timestamp, integer, boolean,
  primaryKey, unique, foreignKey, check,
} from "drizzle-orm/pg-core";

export const groupRole = pgEnum("group_role", ["head_coach", "coach"]);
const createdAt = () => timestamp("created_at", { withTimezone: true }).defaultNow().notNull();

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});

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
  primaryColor: text("primary_color").notNull().default("#176345"),
  accentColor: text("accent_color").notNull().default("#e7d995"),
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
  durationMinutes: integer("duration_minutes").notNull().default(60),
  generationDaysBefore: integer("generation_days_before").notNull().default(3),
  createdAt: createdAt(),
}, (table) => [
  unique("groups_club_id_id_unique").on(table.clubId, table.id),
  check("duration_range", sql`${table.durationMinutes} between 15 and 240`),
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
]);
