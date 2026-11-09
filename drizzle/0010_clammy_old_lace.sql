ALTER TABLE "training_events" DROP CONSTRAINT "event_status";--> statement-breakpoint
ALTER TABLE "training_events" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "training_events" ADD COLUMN "plan_deleted_at" timestamp with time zone;--> statement-breakpoint
UPDATE "training_events" SET "cancelled_at" = "created_at", "status" = 'draft' WHERE "status" = 'cancelled';--> statement-breakpoint
UPDATE "session_versions" SET "event_snapshot" = jsonb_set("event_snapshot", '{status}', '"draft"'::jsonb)
WHERE "event_snapshot"->>'status' = 'cancelled';--> statement-breakpoint
UPDATE "planning_history" SET
	"before_snapshot" = CASE WHEN "before_snapshot" IS NULL THEN NULL ELSE
		jsonb_set(jsonb_set("before_snapshot", '{event,status}', CASE WHEN "before_snapshot"->'event'->>'status' = 'cancelled' THEN '"draft"'::jsonb ELSE "before_snapshot"->'event'->'status' END),
		'{cancelled}', CASE WHEN "before_snapshot"->'event'->>'status' = 'cancelled' THEN 'true'::jsonb ELSE 'false'::jsonb END) END,
	"after_snapshot" = CASE WHEN "after_snapshot" IS NULL THEN NULL ELSE
		jsonb_set(jsonb_set("after_snapshot", '{event,status}', CASE WHEN "after_snapshot"->'event'->>'status' = 'cancelled' THEN '"draft"'::jsonb ELSE "after_snapshot"->'event'->'status' END),
		'{cancelled}', CASE WHEN "after_snapshot"->'event'->>'status' = 'cancelled' THEN 'true'::jsonb ELSE 'false'::jsonb END) END
WHERE "entity_type" = 'session';--> statement-breakpoint
ALTER TABLE "training_events" ADD CONSTRAINT "event_status" CHECK ("training_events"."status" in ('draft', 'planned'));