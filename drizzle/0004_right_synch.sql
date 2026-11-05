ALTER TABLE "training_events" ADD COLUMN "end_time" text;--> statement-breakpoint
ALTER TABLE "training_times" ADD COLUMN "end_time" text;--> statement-breakpoint
UPDATE "training_events"
SET "end_time" = to_char(("start_time"::time + "duration_minutes" * interval '1 minute'), 'HH24:MI')
WHERE "end_time" IS NULL;--> statement-breakpoint
UPDATE "training_times" AS t
SET "end_time" = to_char((t."start_time"::time + g."duration_minutes" * interval '1 minute'), 'HH24:MI')
FROM "groups" AS g
WHERE t."group_id" = g."id" AND t."end_time" IS NULL;--> statement-breakpoint
UPDATE "session_versions"
SET "event_snapshot" = "event_snapshot" || jsonb_build_object(
  'endTime', to_char((("event_snapshot"->>'startTime')::time + ("event_snapshot"->>'durationMinutes')::integer * interval '1 minute'), 'HH24:MI')
)
WHERE NOT ("event_snapshot" ? 'endTime');--> statement-breakpoint
ALTER TABLE "training_events" ALTER COLUMN "end_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "training_times" ALTER COLUMN "end_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "training_events" ADD CONSTRAINT "event_end_time" CHECK ("training_events"."end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "training_events" ADD CONSTRAINT "event_time_duration" CHECK ("training_events"."duration_minutes" = mod((extract(epoch from "training_events"."end_time"::time)::integer - extract(epoch from "training_events"."start_time"::time)::integer + 86400), 86400) / 60);--> statement-breakpoint
ALTER TABLE "training_times" ADD CONSTRAINT "training_end_time" CHECK ("training_times"."end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');--> statement-breakpoint
ALTER TABLE "training_times" ADD CONSTRAINT "training_time_duration" CHECK (mod((extract(epoch from "training_times"."end_time"::time)::integer - extract(epoch from "training_times"."start_time"::time)::integer + 86400), 86400) / 60 between 15 and 240);