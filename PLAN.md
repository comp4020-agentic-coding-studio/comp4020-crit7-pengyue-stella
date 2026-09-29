# PLAN — ANU Discover

## Product

The existing ANU events calendar answers "what events exist?" This slice
answers "which events are relevant to me?" One end-to-end slice: browse, filter,
save, review saved events. No calendar grid, no scraping, no accounts.

## User flow

1. Land on `/` (Discover): a scannable grid of event cards, newest/soonest
   first.
2. Filter by category (chips: Technology & AI, Careers, Research Talks, Arts &
   Culture, Social & Wellbeing) and by time (Today / This week / Weekend) —
   plain links with query params (`/?category=…&when=…`), so filtering works
   with no JS and is trivially testable over HTTP.
3. Each card: title, category, date/time, location, one-line description, and
   a "Save" button.
4. Save POSTs to `/api/saved-events`, redirects back to where the student was.
5. `/my-events` lists saved events (joined against `events`), each with a
   "Remove" action (the natural complement to Save, same form pattern).
6. Saved state persists across reload — same SQLite-on-a-Fly-volume pattern the
   guestbook already proves works in this repo.

## Data model (`src/lib/schema.ts`)

- `events`: id, title, category (text, one of the five), startsAt (ISO text),
  location, description, createdAt.
- `savedEvents`: id, eventId (FK → events.id, unique — can't save twice),
  savedAt.
- Drop `messages` (the guestbook table) — this feature replaces it.
- `pnpm db:generate` after editing, commit the migration.

## Seed data

10–12 realistic ANU-style events, hand-written, seeded idempotently at server
boot (`src/lib/db.ts`, insert only if `events` is empty) so a fresh database —
dev, spec's throwaway db, and the deployed volume on first boot — always has
data. Dates are computed relative to `Date.now()` at seed time (not hardcoded),
spread across today / this week / the coming weekend / further out, so the time
filters have real, reload-stable data to filter regardless of what day the app
boots.

## Persistence path

Same shape as the guestbook: `better-sqlite3` + Drizzle, migrations run at boot
against `DATABASE_PATH` (the Fly volume in production). No new infra.

## Routes/pages

- `/` — Discover feed (rewrite of `index.astro`)
- `/my-events` — saved events (new)
- `/readme/` — unchanged mechanism, content rewritten
- `POST /api/saved-events` — save (replaces `/api/messages`)
- `POST /api/saved-events/remove` — unsave
- Keep `/api/events` (SSE) and its bus as-is — CI's deploy job probes it
  independently of the guestbook's message feature, so it stays even though
  nothing in this feature emits to it.
- Update `spec/routes.ts` to add `/my-events`.

## Checks/tests

- Delete `spec/guestbook.test.ts` (describes the retired starter feature).
- Add `spec/crit-7.test.ts`:
  - save → reload persistence (adapts guestbook's fetch-with-Origin pattern)
  - a category filter actually narrows the served page's events
  - all five categories are present as filter options
- Keep `spec/invariants.test.ts` and `spec/readme.test.ts` green as-is.

## Visual verification

`agent-browser` (or dev server + manual check) at 1920×1080 and 390×844:
feed renders as a card grid not a table, filters visibly change what's shown,
save/remove work, no console errors, no leftover "Guestbook" text.

## Deployment verification

`flyctl deploy` to the existing `comp4020-crit7-pengyue-stella` Fly app, then
against the live `*.fly.dev` URL: save an event, reload, confirm it's still
saved (and inspect the SQLite row on the volume via `flyctl ssh console`).
