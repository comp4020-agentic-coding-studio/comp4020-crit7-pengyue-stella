# Process overview

The starter shipped a guestbook (message list + form). This deliverable
replaces it with ANU Discover: a browse/filter/save event feed. Four
checkpoint commits carry the work; each was made only once `pnpm check` was
green, and each is where a real decision or correction landed.

## The scoping decision

The brief's risk was rebuilding the whole ANU events system. The plan
committed alongside the first checkpoint,
[`e58c01b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/e58c01b702a42e084e54a8c0575c0f22e5d7777c)
(`PLAN.md`), fixes the scope before any UI exists: **discovery, not a
calendar** — a scannable card feed instead of a grid of dates, filterable by
category and by today/this-week/weekend, with saving as the only stateful
action. No search, no per-event pages, no accounts. That constraint is what
kept the remaining three checkpoints small.

## The four checkpoints

1. [`e58c01b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/e58c01b702a42e084e54a8c0575c0f22e5d7777c) —
   data model and persistence foundation. Drops the guestbook's `messages`
   table, adds `events` + `saved_events` (Drizzle migration, not a hand
   edit), and seeds 12 ANU-style mock events idempotently — spread across
   all 5 categories and today/this-week/weekend so every filter combination
   has something to show. `index.astro` is a placeholder list here on
   purpose: this checkpoint is proving the data layer, not the UI.
2. [`2ca9d55`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/2ca9d554988139108fe433b69b629d6ab14c0089) —
   the real Discover feed: category and time filter chips, the responsive
   card grid, the empty state. Filtering is plain `?category=&when=` links,
   not a client-side widget — a deliberate choice, not the template's
   default, made because it gives desktop and mobile identical behaviour for
   free and matches "calm, not dense" better than a JS filter control would.
   Verified in a real browser at both marking viewports before commit.
3. [`516f6bd`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/516f6bd5239cf2e4c47636f7c97bf35bbb3bc750) —
   save/unsave and My Events. `spec/crit-7.test.ts` proves persistence by
   saving over HTTP and re-fetching `/my-events` as an independent request,
   not by trusting in-memory state. I didn't stop at the test: I saved an
   event through a real browser click, opened `.data/app.db` directly and
   confirmed the `saved_events` row joined correctly to `events`, reloaded
   the page to see the badge survive, then removed it and confirmed the row
   was gone. The commit message records that check because the test alone
   doesn't prove a real row exists — only a row in the actual database file
   does.
4. [`f9f8723`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/f9f872388ea2a522b0e770041de4d5df9edef214) —
   visual/responsive pass across all three pages at 1920×1080 and 390×844,
   console-error check, and retiring the `spec/README.md` section that
   documented the now-deleted guestbook test (per that section's own note
   that it retires with the starter).

## A correction the browser forced

The filter chips mark the active one with `aria-current`. My first pass wrote
that as a raw boolean expression (`aria-current={category === undefined}`),
which is wrong for a non-standard ARIA attribute — Astro doesn't collapse it
to the "omit when false" convention the way it does for real HTML boolean
attributes, so an inactive chip would have shipped `aria-current="false"`
instead of no attribute at all. I caught this before the commit landed by
checking the rendered HTML rather than trusting the source, and fixed it to
`aria-current={condition ? "true" : undefined}` everywhere it's used — the
form committed in
[`2ca9d55`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/2ca9d554988139108fe433b69b629d6ab14c0089).
It's a small thing, but it's exactly the class of bug that only shows up when
you read what actually got served instead of what the JSX looks like it
should produce.

## Deploying and verifying production

After `pnpm check` was green locally, I deployed to the existing Fly.io app
(`flyctl deploy --remote-only --ha=false`) and treated that as a separate
thing to verify, not something a green local check implies. Direct database
inspection over `flyctl ssh console` hit `sqlite3: executable file not found`
— the deployed image is slim and has no SQLite CLI. Rather than add one to
the `Dockerfile`, I reused the app's own already-bundled `better-sqlite3`
dependency with a one-line Node script run over the same SSH session,
querying `/data/app.db` directly. That confirmed, against the live
production volume: all 12 seed events present, and — after saving an event
through a real browser click against the production URL, confirming it
survived a reload and appeared on `/my-events`, then removing it again — the
`saved_events` table back at 0 rows, clean.

## A genuine correction: from categorisation to discovery

The four checkpoints above shipped a working browse/filter/save feed, and
every check was green — but green checks don't verify the product idea, only
the implementation of whatever idea you gave them. Reviewing the result
against the brief and, directly, against ANU's own events site exposed a
framing problem: the first version treated the problem as event
categorisation; comparison against the existing ANU Events site showed that
this was not enough, so the prototype shifted to student-centred discovery
and progressive reduction. A category filter over an events list is what
ANU's own site already is — five institutional topic tags don't answer a
different question than the one that site already answers, they just answer
it with nicer CSS.

The fix wasn't a rebuild. It was the smallest coherent change that made the
first screen ask "what do you want to get out of the next few days?" instead
of "which category?": the same five slots that held institutional topics
(Workshops, Talks, Careers, Social, Wellbeing) now hold student intents
(Learn something, Build my career, Meet people, Try something new, Take a
break), the bare `/` screen shows the five intent choices and *no* event
cards at all — narrowing only starts once an intent is picked — and the old
today/this-week/weekend filter is joined by mode (on campus/online) and
price (free) as secondary, practical narrowing, never the primary axis. The
existing persistence, save/unsave flow, and database layer didn't need to
change and didn't: `saved_events` and the save/remove API routes are
untouched. Landed in
[`ab82ad8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/ab82ad8ecc2b882eded4559144ab183c901d7db5),
which rewrites the schema (`intent`/`mode`/`is_free` replacing `category`),
the seed data (12 events redistributed 2–3 per intent, so a small result set
is a property of the data rather than a display cap), `index.astro`'s
progressive-reduction template, and `spec/crit-7.test.ts`'s contract (the
bare screen shows no cards; an intent narrows to a small, distinct set;
mode/price narrow further; save-reload-remove still persists).

Verified the same way as the original build, not assumed from green checks
alone: `pnpm check` (typecheck + full suite) green before commit, the
rendered page checked in a real browser (`agent-browser`) at both marking
viewports locally, then deployed
(`flyctl deploy --remote-only --ha=false -a comp4020-crit7-pengyue-stella`)
and the whole flow re-verified against production — intent choice narrows
results, mode/price filters narrow further, saving an event survives a
reload of `/my-events`, and a direct `better-sqlite3` query over
`flyctl ssh console` confirmed the live database actually holds the new
12-event, intent-tagged dataset with `saved_events` back at 0 rows after the
manual save/remove check.

## Where to look

- `PLAN.md` — the scope decision, written before any UI code.
- [`e58c01b`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/e58c01b702a42e084e54a8c0575c0f22e5d7777c)`...`[`f9f8723`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/f9f872388ea2a522b0e770041de4d5df9edef214) —
  the full range:
  [`e58c01b...f9f8723`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/compare/e58c01b...f9f8723).
- [`ab82ad8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit7-pengyue-stella/commit/ab82ad8ecc2b882eded4559144ab183c901d7db5) —
  the categorisation-to-discovery correction: intent-based schema, redesigned
  progressive-reduction feed, rewritten spec and README.
- `spec/crit-7.test.ts` — the persistence and progressive-reduction contract,
  run against the built server with a throwaway database.
