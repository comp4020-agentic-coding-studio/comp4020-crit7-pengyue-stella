-- The new college/image_url/official_url columns just added by 0005 landed
-- on every existing row with placeholder defaults ('ANU', '', ''), not real
-- content — those rows predate the visual/content polish pass this migration
-- is part of. Every existing row is still disposable seed data from manual
-- testing, so clearing it lets db.ts's idempotent seedEvents() repopulate
-- with the full, richly-tagged event set on next boot, exactly as it does
-- for a brand-new database. Any saved_events rows are test artifacts of the
-- same disposable data and must go first, or the foreign key from
-- saved_events to events blocks the delete below.
DELETE FROM `saved_events`;--> statement-breakpoint
DELETE FROM `events`;
