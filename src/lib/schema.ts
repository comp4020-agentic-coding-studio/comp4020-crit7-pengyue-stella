import { sql } from "drizzle-orm";
import { int, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

// The schema is the ground truth for the database. To change it: edit here,
// run `pnpm db:generate` to turn the diff into a migration under drizzle/,
// and commit both — the migration applies automatically when the server
// boots (see src/lib/db.ts), locally and deployed. Never edit the database
// by hand: state on the deployed volume outlives every deploy, and the
// migration trail is what keeps old state and new code compatible.
//
// Events are tagged by student intent, not institutional topic — "what do
// you want out of it" rather than "what department runs it". This is the
// product's core discovery axis: the first screen asks the student to pick
// one before anything else is shown.
export const INTENTS = [
  { value: "learn", label: "Learn something" },
  { value: "career", label: "Build my career" },
  { value: "meet", label: "Meet people" },
  { value: "try", label: "Try something new" },
  { value: "break", label: "Take a break" },
] as const;

export type Intent = (typeof INTENTS)[number]["value"];

export const MODES = [
  { value: "on_campus", label: "On campus" },
  { value: "online", label: "Online" },
] as const;

export type Mode = (typeof MODES)[number]["value"];

export const events = sqliteTable("events", {
  id: int().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  intent: text().notNull().$type<Intent>().default("learn"),
  mode: text().notNull().$type<Mode>().default("on_campus"),
  isFree: int("is_free", { mode: "boolean" }).notNull().default(true),
  startsAt: text("starts_at").notNull(),
  location: text().notNull(),
  // Why it's worth going, not what it is — the feed leads with relevance,
  // not a factual summary.
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
