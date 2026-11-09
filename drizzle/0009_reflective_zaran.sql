CREATE TABLE "planning_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"plan_year" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"parent_id" uuid,
	"action" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" uuid,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planning_history_year_range" CHECK ("planning_history"."plan_year" between 2000 and 2100),
	CONSTRAINT "planning_history_entity_type" CHECK ("planning_history"."entity_type" in ('session', 'annual_plan', 'plan_period')),
	CONSTRAINT "planning_history_action" CHECK ("planning_history"."action" in ('created', 'updated', 'deleted', 'status_changed')),
	CONSTRAINT "planning_history_actor_type" CHECK ("planning_history"."actor_type" in ('user', 'ai', 'system'))
);
--> statement-breakpoint
ALTER TABLE "planning_history" ADD CONSTRAINT "planning_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planning_history" ADD CONSTRAINT "planning_history_club_id_group_id_groups_club_id_id_fk" FOREIGN KEY ("club_id","group_id") REFERENCES "public"."groups"("club_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planning_history_entity_idx" ON "planning_history" USING btree ("group_id","entity_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "planning_history_year_idx" ON "planning_history" USING btree ("group_id","plan_year","created_at");--> statement-breakpoint
WITH snapshots AS (
	SELECT "session_versions".*,
		jsonb_build_object('event', "event_snapshot", 'plan', "plan") AS snapshot,
		lag(jsonb_build_object('event', "event_snapshot", 'plan', "plan")) OVER (PARTITION BY "event_id" ORDER BY "version") AS previous_snapshot,
		row_number() OVER (PARTITION BY "event_id" ORDER BY "version") AS sequence_number
	FROM "session_versions"
)
INSERT INTO "planning_history" (
	"club_id", "group_id", "plan_year", "entity_type", "entity_id", "action", "actor_type", "actor_id",
	"before_snapshot", "after_snapshot", "created_at"
)
SELECT "club_id", "group_id", substring("event_snapshot"->>'date' from 1 for 4)::integer, 'session', "event_id",
	CASE
		WHEN "sequence_number" = 1 THEN 'created'
		WHEN "previous_snapshot"->'event'->>'status' IS DISTINCT FROM "event_snapshot"->>'status' THEN 'status_changed'
		ELSE 'updated'
	END,
	CASE WHEN "origin" = 'ai' THEN 'ai' ELSE 'user' END, "created_by",
	"previous_snapshot", "snapshot", "created_at"
FROM snapshots;