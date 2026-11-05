CREATE TABLE "annual_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"birth_year" integer,
	"objectives" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "annual_plan_group_year" UNIQUE("group_id","year"),
	CONSTRAINT "annual_plan_tenant_id" UNIQUE("club_id","group_id","id"),
	CONSTRAINT "annual_plan_year_range" CHECK ("annual_plans"."year" between 2000 and 2100)
);
--> statement-breakpoint
CREATE TABLE "plan_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"annual_plan_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"theme" text NOT NULL,
	"objectives" text NOT NULL,
	"progression" text DEFAULT '' NOT NULL,
	"source_url" text DEFAULT '' NOT NULL,
	CONSTRAINT "period_date_order" CHECK ("plan_periods"."end_date" >= "plan_periods"."start_date")
);
--> statement-breakpoint
CREATE TABLE "session_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"created_by" uuid NOT NULL,
	"origin" text NOT NULL,
	"event_snapshot" jsonb NOT NULL,
	"plan" jsonb NOT NULL,
	"planning_context" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_version_number" UNIQUE("event_id","version"),
	CONSTRAINT "session_origin" CHECK ("session_versions"."origin" in ('manual', 'ai'))
);
--> statement-breakpoint
CREATE TABLE "training_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"date" date NOT NULL,
	"start_time" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"title" text NOT NULL,
	"theme" text DEFAULT '' NOT NULL,
	"objectives" text DEFAULT '' NOT NULL,
	"recurrence_key" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_tenant_id" UNIQUE("club_id","group_id","id"),
	CONSTRAINT "event_group_slot" UNIQUE("group_id","date","start_time"),
	CONSTRAINT "event_recurrence_key" UNIQUE("group_id","recurrence_key"),
	CONSTRAINT "event_duration_range" CHECK ("training_events"."duration_minutes" between 15 and 240),
	CONSTRAINT "event_status" CHECK ("training_events"."status" in ('draft', 'planned', 'cancelled')),
	CONSTRAINT "event_time" CHECK ("training_events"."start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
ALTER TABLE "annual_plans" ADD CONSTRAINT "annual_plans_club_id_group_id_groups_club_id_id_fk" FOREIGN KEY ("club_id","group_id") REFERENCES "public"."groups"("club_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_periods" ADD CONSTRAINT "plan_periods_club_id_group_id_annual_plan_id_annual_plans_club_id_group_id_id_fk" FOREIGN KEY ("club_id","group_id","annual_plan_id") REFERENCES "public"."annual_plans"("club_id","group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_versions" ADD CONSTRAINT "session_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_versions" ADD CONSTRAINT "session_versions_club_id_group_id_event_id_training_events_club_id_group_id_id_fk" FOREIGN KEY ("club_id","group_id","event_id") REFERENCES "public"."training_events"("club_id","group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_events" ADD CONSTRAINT "training_events_club_id_group_id_groups_club_id_id_fk" FOREIGN KEY ("club_id","group_id") REFERENCES "public"."groups"("club_id","id") ON DELETE cascade ON UPDATE no action;