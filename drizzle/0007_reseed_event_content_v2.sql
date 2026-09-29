-- Content/visual enhancement pass: seedEvents() in db.ts now has a much wider
-- college/source spread (CSS, Business & Economics, Law, Asia & the Pacific,
-- Career Central and more) and real photographs instead of illustrations, all
-- under new image paths. The rows already in the database are the old
-- 12-event placeholder set and would otherwise sit alongside the new set
-- forever, so clear them and let the idempotent seedEvents() repopulate on
-- next boot, exactly as 0006 did for the previous content pass. saved_events
-- must go first, or the foreign key from saved_events to events blocks the
-- delete below.
DELETE FROM `saved_events`;--> statement-breakpoint
DELETE FROM `events`;
