# Process overview

I built ANU Discover, a cross-college student event discovery platform. It
helps students find events by intent, by college and by time, see the details
that actually matter for one event, follow the real ANU link for booking, and
save events that stay saved across visits. Below are the moments where the
product actually changed direction, not a diary of every commit.

## Moment 1: from categorising events to helping students decide

The first four checkpoints built a working browse/filter/save feed with five
category filters (Workshops, Talks, Careers, Social, Wellbeing). Every check
was green. But green checks only prove the code matches the idea I gave it,
not that the idea was right.

I opened ANU's real events site next to mine and compared them directly. My
categories were just institutional topic tags over a list, the same thing
ANU's site already does. It answers "what events exist," not "what is worth
my time this week." Adding more categories would have polished the wrong
idea instead of fixing it.

So I reframed the product in
[`ab82ad8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/ab82ad8ecc2b882eded4559144ab183c901d7db5).
The five slots became student intents (learn something, build my career,
meet people, try something new, take a break). The homepage now shows no
events until a student picks an intent, and time/mode/price became secondary
filters that narrow an already small set. I verified it the same way as the
original build: `pnpm check` green, the rendered page checked in a real
browser at both marking viewports, then deployed and re-checked on the live
URL.

## Moment 2: making the college spread real, not decorative

Before this pass, `src/lib/db.ts` seeded 12 events across 9 source labels,
but two whole colleges, Law and Asia and the Pacific, had none at all, and
Systems & Society, which covers Computing, Cybernetics, Engineering, Maths
and Environment, was split into two thin inconsistent labels. The product
claimed cross-college discovery but the data didn't really show it.

I rewrote the seed data in
[`2de6f00`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/2de6f0092751a85c0ab4918a6a886b87b34e600f)
to 20 events across 10 real colleges and sources, deliberately uneven:
Systems & Society gets 6 events because it genuinely covers more
departments, Career Central gets 4, smaller colleges get 1 or 2. Padding
every college to the same count would look tidier but would misrepresent how
ANU is actually organised. I verified this with curl against the running
app: exactly 4 events per intent, college filters narrowing counts correctly
(CSS under "learn" goes from 4 to 2), repeated against the deployed Fly app.

## Moment 3: proving persistence with a real save, not a passing test

`spec/crit-7.test.ts`, from
[`516f6bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/516f6bd5239cf2e4c47636f7c97bf35bbb3bc750),
proves saving works by posting to the API and re-fetching `/my-events` as a
separate request, not by trusting anything held in memory. I didn't stop
there. I saved an event through a real browser click, opened the SQLite file
directly, and watched the row join to the right event. I reloaded the page
to see the badge survive, then removed it and watched the row disappear. I
repeated the exact cycle against the deployed production app this session,
using a cookie jar against `comp4020-crit7-pengyue-stella.fly.dev`: saved
event 38, confirmed it was still there on a fresh request, removed it, and
confirmed `/my-events` went back to empty. A test proves the code does what
I told it. Only the running app and its real data prove the product works.

## Moment 4: a migration that could have taken production down

Migration `0004`, part of
[`ab82ad8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/ab82ad8ecc2b882eded4559144ab183c901d7db5),
deleted every row from `events` to reseed it, but never cleared
`saved_events` first. SQLite's foreign key from `saved_events.event_id` to
`events.id` means that delete fails the moment any event has been saved. In
`src/lib/db.ts`, migrations run at boot, before the app serves a single
request, so a failed migration would have taken the whole site down, not
just one page. The only reason it didn't happen is that I manually checked
`saved_events` was empty in production first, a safeguard that only holds
until someone actually saves something.

I fixed the pattern properly in migration `0006`, part of
[`63ebce2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/63ebce2f5c1ec6997a3859548b4f837af5d3dacd):
clear `saved_events` before `events`, every time, so the migration is safe
no matter what's saved. I carried the same fix into migration `0007` for
this session's reseed
([`2de6f00`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/2de6f0092751a85c0ab4918a6a886b87b34e600f)),
whose own comment points back at `0006` as the reason. I verified the fixed
migration by deploying it to the live app and confirming both tables ended
up right: events repopulated, `saved_events` empty until I saved something
myself and watched it appear.

## Where to look

- [`ab82ad8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/ab82ad8ecc2b882eded4559144ab183c901d7db5) —
  the categorisation-to-discovery reframe, and the migration that carried the
  foreign key risk.
- [`63ebce2`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/63ebce2f5c1ec6997a3859548b4f837af5d3dacd) —
  the migration fix (`0006`), real photos, event detail pages, college
  filtering.
- [`2de6f00`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/2de6f0092751a85c0ab4918a6a886b87b34e600f) —
  the 20-event, 10-college rewrite and the corrected reseed pattern carried
  into `0007`.
- [`516f6bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/516f6bd5239cf2e4c47636f7c97bf35bbb3bc750) —
  the save/unsave persistence contract.
- `spec/crit-7.test.ts` — the persistence and progressive-reduction contract,
  run against the built server with a throwaway database.
