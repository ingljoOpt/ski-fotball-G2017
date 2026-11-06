ALTER TABLE "groups" ADD COLUMN "birth_year" integer;--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "group_birth_year_range" CHECK ("groups"."birth_year" between 1900 and 2100);--> statement-breakpoint
UPDATE "groups" AS team
SET "birth_year" = history.birth_year
FROM (
  SELECT "group_id", MIN("birth_year") AS birth_year
  FROM "annual_plans"
  WHERE "birth_year" IS NOT NULL
  GROUP BY "group_id"
  HAVING COUNT(DISTINCT "birth_year") = 1 AND MIN("birth_year") BETWEEN 1900 AND 2100
) AS history
WHERE team."id" = history."group_id" AND team."birth_year" IS NULL;