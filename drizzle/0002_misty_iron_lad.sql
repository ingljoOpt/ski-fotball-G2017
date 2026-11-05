ALTER TABLE "clubs" ADD COLUMN "primary_color" text DEFAULT '#176345' NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "accent_color" text DEFAULT '#e7d995' NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD COLUMN "logo_data" text;