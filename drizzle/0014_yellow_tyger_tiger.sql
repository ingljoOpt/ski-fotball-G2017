CREATE TABLE "session_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"review" jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_review_author" UNIQUE("event_id","author_id"),
	CONSTRAINT "session_review_revision" CHECK ("session_reviews"."revision" > 0)
);
--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_club_id_group_id_event_id_training_events_club_id_group_id_id_fk" FOREIGN KEY ("club_id","group_id","event_id") REFERENCES "public"."training_events"("club_id","group_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_versions" ADD CONSTRAINT "session_version_event_id_unique" UNIQUE("event_id","id");--> statement-breakpoint
ALTER TABLE "session_reviews" ADD CONSTRAINT "session_reviews_event_id_version_id_session_versions_event_id_id_fk" FOREIGN KEY ("event_id","version_id") REFERENCES "public"."session_versions"("event_id","id") ON DELETE cascade ON UPDATE no action;