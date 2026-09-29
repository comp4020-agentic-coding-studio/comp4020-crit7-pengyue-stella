ALTER TABLE `events` DROP COLUMN `category`;
--> statement-breakpoint
-- Every existing row is disposable seed data (no real save referenced any of
-- it — saved_events was empty before this migration), and it predates the
-- intent/mode/is_free columns this migration finishes adding, so it carries
-- meaningless defaults rather than real values. Clearing it lets db.ts's
-- idempotent seedEvents() repopulate with the redesigned, correctly-tagged
-- event set on next boot, exactly as it does for a brand-new database.
DELETE FROM `events`;