CREATE TABLE "custom_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"theme" text DEFAULT '' NOT NULL,
	"theme_source" text DEFAULT '' NOT NULL,
	"objectives" text DEFAULT '' NOT NULL,
	"age_min" integer NOT NULL,
	"age_max" integer NOT NULL,
	"video_url" text DEFAULT '' NOT NULL,
	"animations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_exercise_age_range" CHECK ("custom_exercises"."age_min" >= 3 and "custom_exercises"."age_max" <= 100 and "custom_exercises"."age_min" <= "custom_exercises"."age_max")
);
--> statement-breakpoint
ALTER TABLE "custom_exercises" ADD CONSTRAINT "custom_exercises_club_id_group_id_groups_club_id_id_fk" FOREIGN KEY ("club_id","group_id") REFERENCES "public"."groups"("club_id","id") ON DELETE cascade ON UPDATE no action;