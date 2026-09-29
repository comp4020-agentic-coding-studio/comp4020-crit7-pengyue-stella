import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { and, asc, eq, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { type Event, type Intent, type Mode, events, savedEvents } from "./schema";
import { dayRange, thisWeekRange, todayRange, weekendRange } from "./schedule";

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

export type { Event, Intent, Mode };
export type When = "today" | "week" | "weekend";

export interface EventFilter {
  intent?: Intent;
  when?: When;
  mode?: Mode;
  free?: boolean;
  college?: string;
  /** Offset into the "This week at ANU" 7-day strip: 0 is today, 6 is six days out. */
  day?: number;
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
// happened), soonest first, narrowed by intent (required for a non-empty
// result — see index.astro, which never calls this without one) and
// optionally by time window, mode and price.
export function listEvents(filter: EventFilter = {}, now: Date = new Date()): Event[] {
  const conditions = [gte(events.startsAt, todayRange(now).start.toISOString())];
  if (filter.intent) conditions.push(eq(events.intent, filter.intent));
  if (filter.mode) conditions.push(eq(events.mode, filter.mode));
  if (filter.free) conditions.push(eq(events.isFree, true));
  if (filter.college) conditions.push(eq(events.college, filter.college));
  const range = whenRange(filter.when, now);
  if (range) {
    conditions.push(gte(events.startsAt, range.start.toISOString()));
    conditions.push(lt(events.startsAt, range.end.toISOString()));
  }
  if (filter.day !== undefined) {
    const day = dayRange(now, filter.day);
    conditions.push(gte(events.startsAt, day.start.toISOString()));
    conditions.push(lt(events.startsAt, day.end.toISOString()));
  }
  return db
    .select()
    .from(events)
    .where(and(...conditions))
    .orderBy(asc(events.startsAt))
    .all();
}

// Event counts for each day of the "This week at ANU" strip (offsets 0..6),
// under the same intent/mode/free/college filters already active — so the
// number shown on a day tile is exactly what clicking it will reveal.
export function countEventsByDay(filter: Omit<EventFilter, "day"> = {}, now: Date = new Date()): number[] {
  return Array.from({ length: 7 }, (_, offset) => listEvents({ ...filter, day: offset }, now).length);
}

// The colleges/schools with at least one upcoming event under this intent —
// scoped to intent only (not the practical filters) so the list of chips
// stays stable while a student toggles when/mode/free, the same way the
// when/mode chips themselves never disappear.
export function listColleges(intent: Intent, now: Date = new Date()): string[] {
  const rows = db
    .selectDistinct({ college: events.college })
    .from(events)
    .where(and(gte(events.startsAt, todayRange(now).start.toISOString()), eq(events.intent, intent)))
    .all();
  return rows.map((row) => row.college).sort();
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
      intent: events.intent,
      mode: events.mode,
      isFree: events.isFree,
      startsAt: events.startsAt,
      location: events.location,
      college: events.college,
      description: events.description,
      imageUrl: events.imageUrl,
      officialUrl: events.officialUrl,
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
  const [wd1, , wd3, wd4] = weekdayOffsets;

  // Deliberately uneven across colleges — ANU College of Systems & Society
  // gets the most (one per named sub-theme: computing, mathematics, public
  // talks/research, cybernetics, engineering, environment), because it's the
  // college this pass is meant to make visible; the rest range from one to
  // four events each, the way a real week at ANU would actually look.
  db.insert(events)
    .values([
      {
        title: "AI in Research: A Hands-On Workshop",
        intent: "learn",
        mode: "on_campus",
        isFree: true,
        location: "Hackerspace, CSIT Building",
        college: "ANU College of Systems & Society",
        description:
          "Two hands-on hours on prompting and evaluation you can use in your own project tonight — no slides, just building. Bring a laptop; small groups, real feedback from the people running it.",
        imageUrl: "/images/events/computing_ai_workshop.jpg",
        officialUrl: "https://systems.anu.edu.au",
        startsAt: at(start, 18),
      },
      {
        title: "Public Lecture: Quantum Computing Frontiers",
        intent: "learn",
        mode: "online",
        isFree: true,
        location: "Livestreamed from the Research School of Physics",
        college: "ANU College of Science and Medicine",
        description:
          "One talk and you'll actually understand what people mean by \"quantum advantage\" — no physics background needed. Runs an hour, with time at the end for questions from the livestream chat.",
        imageUrl: "/images/events/science_quantum.jpg",
        officialUrl: "https://science.anu.edu.au",
        startsAt: at(start, 17, 30),
      },
      {
        title: "Public Maths Colloquium: The Shape of Chance",
        intent: "learn",
        mode: "on_campus",
        isFree: true,
        location: "Hanna Neumann Building, Seminar Room 1.33",
        college: "ANU College of Systems & Society",
        description:
          "Probability made visual, not symbolic — the kind of talk that makes sense whether or not you've done a stats course. Coffee and biscuits beforehand in the foyer.",
        imageUrl: "/images/events/css_maths.jpg",
        officialUrl: "https://systems.anu.edu.au",
        startsAt: at(day(2), 16),
      },
      {
        title: "Public Lecture: Reforming Australian Migration Law",
        intent: "learn",
        mode: "on_campus",
        isFree: true,
        location: "ANU College of Law, Building 5",
        college: "ANU College of Law, Governance and Policy",
        description:
          "A working lawyer and a policy researcher on what's actually changing and why it matters beyond the headlines. Open to everyone, not just law students.",
        imageUrl: "/images/events/law_migration.jpg",
        officialUrl: "https://law.anu.edu.au",
        startsAt: at(day(4), 13),
      },
      {
        title: "Tech Careers Fair with Industry Partners",
        intent: "career",
        mode: "on_campus",
        isFree: true,
        location: "Career Central, Union Court",
        college: "Career Central",
        description:
          "Recruiters actually hiring ANU students right now — worth an hour even if you're not job-hunting yet. Bring a few copies of your resume; most stalls will take one on the spot.",
        imageUrl: "/images/events/career_fair.jpg",
        officialUrl: "https://careers.anu.edu.au",
        startsAt: at(day(weekendOffset), 10),
      },
      {
        title: "Resume & LinkedIn Clinic",
        intent: "career",
        mode: "online",
        isFree: true,
        location: "Zoom drop-in — link on booking",
        college: "Career Central",
        description:
          "A 15-minute slot that fixes the one line on your resume you've been meaning to fix for a month. One-on-one with a careers adviser, no need to prepare anything beforehand.",
        imageUrl: "/images/events/career_resume.jpg",
        officialUrl: "https://careers.anu.edu.au",
        startsAt: at(day(1), 11),
      },
      {
        title: "Meet the Grad Recruiters: Consulting Panel",
        intent: "career",
        mode: "on_campus",
        isFree: true,
        location: "HW Arndt Building, CBE",
        college: "ANU College of Business & Economics",
        description:
          "Straight answers on what actually gets a grad application shortlisted, from people who read them for a living. Panel plus open floor, so bring the question you actually want answered.",
        imageUrl: "/images/events/business_consulting.jpg",
        officialUrl: "https://cbe.anu.edu.au",
        startsAt: at(day(21), 12),
      },
      {
        title: "Postgrad & Employer Networking Night",
        intent: "career",
        mode: "on_campus",
        isFree: true,
        location: "University House",
        college: "Career Central",
        description:
          "Drinks and canapés with employers who specifically want to talk to postgrads — a smaller, calmer room than the big fair. Smart casual; name tags provided at the door.",
        imageUrl: "/images/events/career_networking.jpg",
        officialUrl: "https://careers.anu.edu.au",
        startsAt: at(day(5), 18),
      },
      {
        title: "Wellbeing Wednesday: Free Breakfast & Chill",
        intent: "meet",
        mode: "on_campus",
        isFree: true,
        location: "Union Court",
        college: "ANU Wellbeing & Support",
        description:
          "Free pancakes and no agenda — one of the easiest ways to end up talking to people outside your own course. Drop in any time between 8 and 10, stay five minutes or the whole thing.",
        imageUrl: "/images/events/wellbeing_breakfast.jpg",
        officialUrl:
          "https://www.anu.edu.au/students/health-safety-wellbeing/getting-help-at-anu/support-wellbeing-medical-academic",
        startsAt: at(day(wd1), 9),
      },
      {
        title: "Student Film Night: Shorts Showcase",
        intent: "meet",
        mode: "on_campus",
        isFree: false,
        location: "Kambri Cinema",
        college: "ANU Students' Association (ANUSA)",
        description:
          "A small $5 door charge covers popcorn — student-made shorts on the big screen, then a chat with the filmmakers after. A relaxed one to bring a friend to.",
        imageUrl: "/images/events/anusa_filmnight.jpg",
        officialUrl: "https://anusa.com.au",
        startsAt: at(day(weekendOffset + 1), 19),
      },
      {
        title: "CSS Research Bazaar: Meet the People Building Tomorrow's Tech",
        intent: "meet",
        mode: "on_campus",
        isFree: true,
        location: "Manning Clark Centre, Foyer",
        college: "ANU College of Systems & Society",
        description:
          "Twenty researchers, twenty stalls, no jargon required — a low-pressure way to find out what's actually happening in computing, engineering and environmental research on your own campus.",
        imageUrl: "/images/events/css_research_bazaar.jpg",
        officialUrl: "https://systems.anu.edu.au",
        startsAt: at(day(3), 12, 30),
      },
      {
        title: "Asia-Pacific Week: Cultural Showcase & Food Fair",
        intent: "meet",
        mode: "on_campus",
        isFree: true,
        location: "Crawford School Courtyard",
        college: "ANU College of Asia and the Pacific",
        description:
          "Student societies from across the region running food stalls and performances on the same afternoon — come hungry. A good one for meeting people outside your own degree entirely.",
        imageUrl: "/images/events/asiapacific_week.jpg",
        officialUrl: "https://asiapacific.anu.edu.au",
        startsAt: at(day(6), 17),
      },
      {
        title: "Cybernetics Studio Open Day: Build, Break, Iterate",
        intent: "try",
        mode: "on_campus",
        isFree: true,
        location: "School of Cybernetics Studio, Marie Reay Building",
        college: "ANU College of Systems & Society",
        description:
          "Walk-in access to the studio's current student projects — part art installation, part engineering prototype. No RSVP, just turn up and start asking questions.",
        imageUrl: "/images/events/css_cybernetics.jpg",
        officialUrl: "https://systems.anu.edu.au",
        startsAt: at(day(1), 14),
      },
      {
        title: "Engineering Open Studio: Robotics Demo Day",
        intent: "try",
        mode: "on_campus",
        isFree: true,
        location: "ANU School of Engineering",
        college: "ANU College of Systems & Society",
        description:
          "Final-year capstone teams demoing what they've actually built this year, from small robots to sensor rigs. Hands-on where it's safe to be — ask before you touch anything else.",
        imageUrl: "/images/events/css_engineering.jpg",
        officialUrl: "https://systems.anu.edu.au",
        startsAt: at(day(1), 17),
      },
      {
        title: "ANU Art Society Exhibition Opening",
        intent: "try",
        mode: "on_campus",
        isFree: true,
        location: "Drill Hall Gallery",
        college: "ANU College of Arts & Social Sciences",
        description:
          "Free drinks, student art, and zero expectation that you know anything about either. The artists are usually around and happy to talk about the work.",
        imageUrl: "/images/events/arts_exhibition.jpg",
        officialUrl: "https://cass.anu.edu.au",
        startsAt: at(day(wd4), 17, 30),
      },
      {
        title: "CBE Trading Game Night: Simulated Markets",
        intent: "try",
        mode: "on_campus",
        isFree: true,
        location: "Peter Karmel Building, CBE",
        college: "ANU College of Business & Economics",
        description:
          "A live trading simulation with fake money and real market pressure — no finance background assumed, just fast decisions under a ticking clock. Prizes for the top desks.",
        imageUrl: "/images/events/business_trading.jpg",
        officialUrl: "https://cbe.anu.edu.au",
        startsAt: at(day(5), 19, 30),
      },
      {
        title: "Three Minute Thesis Grand Final",
        intent: "break",
        mode: "on_campus",
        isFree: true,
        location: "Haydon-Allen Lecture Theatre",
        college: "Career Central",
        description:
          "Eight theses explained in three minutes each — genuinely entertaining, and you don't have to think about your own work. The winner goes on to the Asia-Pacific final.",
        imageUrl: "/images/events/career_3mt.jpg",
        officialUrl: "https://careers.anu.edu.au",
        startsAt: at(day(28), 18, 30),
      },
      {
        title: "Sunset Yoga on Kambri Lawns",
        intent: "break",
        mode: "on_campus",
        isFree: true,
        location: "Willows Oval",
        college: "ANU Sport & Recreation",
        description:
          "Mats provided, no experience assumed — a gentle way to actually stop thinking about uni for forty minutes. Moved indoors to the Sport & Recreation Centre if it rains.",
        imageUrl: "/images/events/sport_yoga.jpg",
        officialUrl: "https://anu-sport.com.au",
        startsAt: at(day(weekendOffset), 8),
      },
      {
        title: "HDR Seminar Series: Modelling Climate Tipping Points",
        intent: "break",
        mode: "on_campus",
        isFree: true,
        location: "Fenner School of Environment & Society, Forestry Building",
        college: "ANU College of Systems & Society",
        description:
          "An hour with someone who thinks about this full-time — a solid excuse for a break from your own reading list. Aimed at a general audience, not just fellow researchers.",
        imageUrl: "/images/events/css_environment.jpg",
        officialUrl: "https://systems.anu.edu.au",
        startsAt: at(day(wd3), 15),
      },
      {
        title: "Moot Court Grand Final: Watch ANU's Best Advocates",
        intent: "break",
        mode: "on_campus",
        isFree: true,
        location: "ANU College of Law, Moot Court Room",
        college: "ANU College of Law, Governance and Policy",
        description:
          "Final-year students argue a real appellate-style case in front of a judging panel — closer to theatre than to a lecture. A fun one to watch even with zero law background.",
        imageUrl: "/images/events/law_mootcourt.jpg",
        officialUrl: "https://law.anu.edu.au",
        startsAt: at(day(3), 18),
      },
    ])
    .run();
}

seedEvents();
