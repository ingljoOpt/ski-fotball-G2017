ALTER TABLE "groups" ADD COLUMN "player_count" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "coach_count" integer;--> statement-breakpoint
ALTER TABLE "training_times" ADD COLUMN "expected_players" integer;--> statement-breakpoint
ALTER TABLE "training_times" ADD COLUMN "expected_coaches" integer;