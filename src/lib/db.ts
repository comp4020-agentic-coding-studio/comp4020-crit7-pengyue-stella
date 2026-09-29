import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { type Category, type Event, events, savedEvents } from "./schema";
import { thisWeekRange, todayRange, weekendRange } from "./schedule";

// One SQLite file is the app's whole persistent state. In production
// fly.toml points DATABASE_PATH at the machine's volume (/data), which is
// how state survives a reload and a redeploy; locally it defaults to an
// untracked file in .data/.
const path = process.env.DATABASE_PATH ?? "./.data/app.db";
mkdirSync(dirname(path), { recursive: true });

const client = new Database(path);
client.pragma("journal_mode = WAL");

export const db = drizzle(client);

// Migrations run at boot, on whatever machine holds the volume — the
// recommended shape for SQLite on Fly, where there's no separate machine to
// run them from. The flow: edit src/lib/schema.ts, `pnpm db:generate`,
// commit the migration it writes to drizzle/.
migrate(db, { migrationsFolder: "./drizzle" });

export type { Event, Category };
export type When = "today" | "week" | "weekend";

export interface EventFilter {
  category?: Category;
  when?: When;
}

function whenRange(when: When | undefined, now: Date) {
  switch (when) {
    case "today":
      return todayRange(now);
    case "week":
      return thisWeekRange(now);
    case "weekend":
      return weekendRange(now);
    default:
      return undefined;
  }
}

// The Discover feed: upcoming events only (nothing that's already fully
// happened), soonest first, narrowed by category and/or time window.
export function listEvents(filter: EventFilter = {}, now: Date = new Date()): Event[] {
  const conditions = [gte(events.startsAt, todayRange(now).start.toISOString())];
  if (filter.category) conditions.push(eq(events.category, filter.category));
  const range = whenRange(filter.when, now);
  if (range) {
    conditions.push(gte(events.startsAt, range.start.toISOString()));
    conditions.push(lt(events.startsAt, range.end.toISOString()));
  }
  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt))
    .all();
}

export function getEvent(eventId: number): Event | undefined {
  return db.select().from(events).where(eq(events.id, eventId)).get();
}

export function saveEvent(eventId: number): void {
  db.insert(savedEvents).values({ eventId }).onConflictDoNothing().run();
}

export function removeSavedEvent(eventId: number): void {
  db.delete(savedEvents).where(eq(savedEvents.eventId, eventId)).run();
}

export function savedEventIds(): Set<number> {
  const rows = db.select({ eventId: savedEvents.eventId }).from(savedEvents).all();
  return new Set(rows.map((row) => row.eventId));
}

export function listSavedEvents(): Event[] {
  return db
    .select({
      id: events.id,
      title: events.title,
      category: events.category,
      startsAt: events.startsAt,
      location: events.location,
      description: events.description,
      createdAt: events.createdAt,
    })
    .from(savedEvents)
    .innerJoin(events, eq(savedEvents.eventId, events.id))
    .orderBy(asc(events.startsAt))
    .all();
}

// Idempotent: only seeds an empty table, so a fresh database — dev, the
// spec's throwaway db, and the deployed volume on first boot — always has
// realistic data, and a database that already has real saves is never
// touched. Dates are computed relative to `now`, not hardcoded, so the time
// filters have real, spread-out data regardless of what day the app boots.
export function seedEvents(now: Date = new Date()): void {
  if (db.select({ id: events.id }).from(events).limit(1).all().length > 0) return;

  const start = todayRange(now).start;
  const day = (n: number) => new Date(start.getTime() + n * 24 * 60 * 60 * 1000);
  const at = (d: Date, hour: number, minute = 0): string =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).toISOString();

  const weekend = weekendRange(now);
  const weekendOffset = Math.round((weekend.start.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  const weekdayOffsets = [1, 2, 3, 4, 5, 6].filter(
    (offset) => offset !== weekendOffset && offset !== weekendOffset + 1,
  );
  const [wd1, wd2, wd3, wd4] = weekdayOffsets;

  db.insert(events)
    .values([
      {
        title: "AI in Research: A Hands-On Workshop",
        category: "Technology & AI",
        location: "Hackerspace, CSIT Building",
        description:
          "Get hands-on with prompting, fine-tuning and eval basics before diving into your own project.",
        startsAt: at(start, 18),
      },
      {
        title: "ANU Coding Club: Build Your First Web App",
        category: "Technology & AI",
        location: "Ian Ross Building",
        description: "A beginner-friendly build-along: ship a small web app in one sitting.",
        startsAt: at(day(wd1), 13),
      },
      {
        title: "Tech Careers Fair with Industry Partners",
        category: "Careers",
        location: "Kambri, Marie Reay Building",
        description: "Meet recruiters from tech, government and startups hiring ANU students.",
        startsAt: at(day(weekendOffset), 10),
      },
      {
        title: "Resume & LinkedIn Clinic",
        category: "Careers",
        location: "Careers Centre, Chancelry",
        description: "Drop in for a 15-minute resume review before applications close.",
        startsAt: at(day(wd2), 11),
      },
      {
        title: "Meet the Grad Recruiters: Consulting Panel",
        category: "Careers",
        location: "Kambri Cultural Centre",
        description: "Ask consulting recruiters what actually gets a grad application shortlisted.",
        startsAt: at(day(21), 12),
      },
      {
        title: "Public Lecture: Quantum Computing Frontiers",
        category: "Research Talks",
        location: "Manning Clark Centre, Theatre 1",
        description: "A public talk on where quantum computing is heading — no physics background required.",
        startsAt: at(start, 17, 30),
      },
      {
        title: "HDR Seminar Series: Modelling Climate Tipping Points",
        category: "Research Talks",
        location: "Fenner School of Environment & Society",
        description: "This week's HDR seminar looks at tipping points in the climate system.",
        startsAt: at(day(wd3), 15),
      },
      {
        title: "Three Minute Thesis Grand Final",
        category: "Research Talks",
        location: "Llewellyn Hall",
        description: "Eight HDR finalists, three minutes each, one thesis explained to a general audience.",
        startsAt: at(day(28), 18, 30),
      },
      {
        title: "Student Film Night: Shorts Showcase",
        category: "Arts & Culture",
        location: "Kambri Cinema",
        description: "Student-made shorts on the big screen, followed by a Q&A with the filmmakers.",
        startsAt: at(day(weekendOffset + 1), 19),
      },
      {
        title: "ANU Art Society Exhibition Opening",
        category: "Arts & Culture",
        location: "ANU School of Art & Design Gallery",
        description: "Opening night for this semester's student exhibition — drinks and nibbles included.",
        startsAt: at(day(wd4), 17, 30),
      },
      {
        title: "Sunset Yoga on Kambri Lawns",
        category: "Social & Wellbeing",
        location: "Kambri Lawns",
        description: "A gentle outdoor session to stretch out the week — mats provided.",
        startsAt: at(day(weekendOffset), 8),
      },
      {
        title: "Wellbeing Wednesday: Free Breakfast & Chill",
        category: "Social & Wellbeing",
        location: "Union Court",
        description: "Free pancakes, board games and a quiet space to decompress mid-week.",
        startsAt: at(day(wd1), 9),
      },
    ])
    .run();
}

seedEvents();
