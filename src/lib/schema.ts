import { sql } from "drizzle-orm";
import { int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
export const CATEGORIES = [
  "Technology & AI",
  "Careers",
  "Research Talks",
  "Arts & Culture",
  "Social & Wellbeing",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const events = sqliteTable("events", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  category: text().notNull().$type<Category>(),
  startsAt: text("starts_at").notNull(),
  location: text().notNull(),
  description: text().notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const savedEvents = sqliteTable(
  "saved_events",
  {
    id: int().primaryKey({ autoIncrement: true }),
    eventId: int("event_id")
      .notNull()
      .references(() => events.id),
    savedAt: text("saved_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [unique().on(table.eventId)],
);

export type Event = typeof events.$inferSelect;
export type SavedEvent = typeof savedEvents.$inferSelect;
