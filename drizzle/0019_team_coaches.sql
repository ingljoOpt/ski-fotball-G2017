CREATE TABLE "coaches" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"club_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"user_id" uuid,
	CONSTRAINT "coaches_group_id_id_pk" PRIMARY KEY("group_id","id"),
	CONSTRAINT "coach_group_email" UNIQUE("group_id","email"),
	CONSTRAINT "coach_group_user" UNIQUE("group_id","user_id"),
	CONSTRAINT "coach_name_length" CHECK (length(trim("coaches"."name")) between 2 and 254),
	CONSTRAINT "coach_user_email" CHECK ("coaches"."user_id" is null or "coaches"."email" is not null)
);
--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coaches" ADD CONSTRAINT "coaches_club_id_group_id_groups_club_id_id_fk" FOREIGN KEY ("club_id","group_id") REFERENCES "public"."groups"("club_id","id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "coaches" ("id", "club_id", "group_id", "name", "email", "user_id")
SELECT members."user_id", members."club_id", members."group_id", users."email", users."email", members."user_id"
FROM "group_members" members
JOIN "users" users ON users."id" = members."user_id";