CREATE TABLE "annual_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "annual_event_date_order" CHECK ("annual_events"."end_date" >= "annual_events"."start_date"),
	CONSTRAINT "annual_event_kind" CHECK ("annual_events"."kind" in ('cup', 'holiday', 'other'))
);
--> statement-breakpoint
ALTER TABLE "annual_events" ADD CONSTRAINT "annual_events_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_events" ADD CONSTRAINT "annual_events_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annual_events" ADD CONSTRAINT "annual_events_club_id_group_id_groups_club_id_id_fk" FOREIGN KEY ("club_id","group_id") REFERENCES "public"."groups"("club_id","id") ON DELETE cascade ON UPDATE no action;