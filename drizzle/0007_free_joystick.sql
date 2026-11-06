ALTER TABLE "clubs" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "slug" text;--> statement-breakpoint
WITH bases AS (
  SELECT id, created_at,
    COALESCE(NULLIF(rtrim(left(trim(both '-' from regexp_replace(
      replace(replace(replace(lower(name), 'æ', 'ae'), 'ø', 'o'), 'å', 'a'),
      '[^a-z0-9]+', '-', 'g')), 80), '-'), ''), 'klubb') AS base
  FROM clubs
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY base ORDER BY created_at, id) AS position FROM bases
)
UPDATE clubs SET slug = CASE WHEN ranked.position = 1 AND ranked.base NOT IN
  ('auth','api','grupper','klubber','oversikt','logg-inn','invitasjon','klubbinvitasjon','media','assets','publiserte')
  THEN ranked.base ELSE ranked.base || '-' || ranked.id::text END
FROM ranked WHERE clubs.id = ranked.id;--> statement-breakpoint
WITH bases AS (
  SELECT id, club_id, created_at,
    COALESCE(NULLIF(rtrim(left(trim(both '-' from regexp_replace(
      replace(replace(replace(lower(name), 'æ', 'ae'), 'ø', 'o'), 'å', 'a'),
      '[^a-z0-9]+', '-', 'g')), 80), '-'), ''), 'lag') AS base
  FROM groups
), ranked AS (
  SELECT *, row_number() OVER (PARTITION BY club_id, base ORDER BY created_at, id) AS position FROM bases
)
UPDATE groups SET slug = CASE WHEN ranked.position = 1 AND ranked.base NOT IN
  ('brukere','innstillinger','lag','ny','okter','kalender','aarsplan','ovelser')
  THEN ranked.base ELSE ranked.base || '-' || ranked.id::text END
FROM ranked WHERE groups.id = ranked.id;--> statement-breakpoint
-- A pre-existing name can itself equal another row's suffixed slug.
DO $$
DECLARE
  duplicate record;
  candidate text;
BEGIN
  FOR duplicate IN
    SELECT id, slug FROM (
      SELECT id, slug, row_number() OVER (PARTITION BY slug ORDER BY created_at, id) AS position FROM clubs
    ) rows WHERE position > 1
  LOOP
    LOOP
      candidate := rtrim(left(duplicate.slug, 80), '-') || '-' || gen_random_uuid()::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM clubs WHERE slug = candidate);
    END LOOP;
    UPDATE clubs SET slug = candidate WHERE id = duplicate.id;
  END LOOP;
  FOR duplicate IN
    SELECT id, club_id, slug FROM (
      SELECT id, club_id, slug, row_number() OVER (PARTITION BY club_id, slug ORDER BY created_at, id) AS position FROM groups
    ) rows WHERE position > 1
  LOOP
    LOOP
      candidate := rtrim(left(duplicate.slug, 80), '-') || '-' || gen_random_uuid()::text;
      EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE club_id = duplicate.club_id AND slug = candidate);
    END LOOP;
    UPDATE groups SET slug = candidate WHERE id = duplicate.id;
  END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "clubs" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "clubs_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_club_slug_unique" UNIQUE("club_id","slug");--> statement-breakpoint
ALTER TABLE "clubs" ADD CONSTRAINT "club_slug_format" CHECK ("clubs"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("clubs"."slug") <= 120);--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "team_slug_format" CHECK ("groups"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length("groups"."slug") <= 120);