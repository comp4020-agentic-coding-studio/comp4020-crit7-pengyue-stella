# ANU Discover

ANU already has an events site that answers "what events exist?" — search,
listings, a calendar. ANU Discover answers a different question: **what is
actually worth my attention this week?** It's a student-centred discovery
layer, not another events directory, built on the principle of **progressive
reduction** — never show the whole catalogue at once.

The first screen asks one question: what do you want to get out of the next
few days? Five intents — Learn something, Build my career, Meet people, Try
something new, Take a break — and nothing else. No cards, no calendar, no
category browser. Only after you pick one does a small, matching set of
events appear (2–3 cards, never 10–12), which you can optionally narrow
further by time (today/this week/weekend), mode (on campus/online) and price
(free). Saving is a real, persisted action to a personal My Events list
that's still there next time you visit.

## What good looks like here

The brief asked for one focused slice done well, not a rebuild of the whole
ANU events system — so the scope is deliberately small: pick an intent,
narrow, save. No search, no ticketing, no per-event detail pages, no
accounts. A card shows exactly what you need to decide whether to go: title,
when, where, and a one-line description written to say *why it's worth
going*, not what it factually is — nothing denser.

Every filter is a plain link (`?intent=...&when=...&mode=...&free=...`), not
a JS widget. That was a judgement call, not a requirement: it keeps desktop
and mobile behaviour identical for free, works with JavaScript off, and
matches "ask one question at a time" better than a client-side control that
has to be built and tested twice. The intent, time, mode and price filters
compose, because a student is usually narrowing on more than one axis at
once — but intent always comes first and is never optional the way the
others are: there is no "browse everything" state.

Saving is a real, persisted action — a `POST` to a small API route that
writes to the same SQLite database the feed reads from, not local state that
disappears on reload. That persistence is enforced:
[`spec/crit-7.test.ts`](spec/crit-7.test.ts) saves an event over HTTP and
re-fetches My Events as an independent request to prove it survived, and
removing an event is checked the same way.

What's a judgement call versus what's enforced:

- **Enforced** (`spec/`, CI): the bare discover screen shows no event cards
  and all five intent choices; choosing an intent narrows to a small, distinct
  set of events; the time/mode/price filters narrow that set further rather
  than relabelling it; saving and removing an event actually persists across
  requests; and the shared accessibility/navigation invariants every
  deliverable carries.
- **Judgement calls** (not something a test can hold you to): the five named
  intents as *the* useful ways to frame "what do you want out of this"; a
  single primary intent per event (rather than letting one event serve
  several intents) as what keeps each intent's set naturally small; and the
  visual design — intent tiles as the entry point, pill-shaped filter chips
  once you're inside an intent, and a card grid that reflows instead of a
  fixed table — as what "asks a question, then answers it" means for this
  brief.

The 12 seed events are realistic ANU-style mock data (talks, career fairs,
society socials, research seminars) generated once at first boot — there's
no scraping and no external API, per the brief. They're distributed 2–3 per
intent, which is what keeps every intent's result set small by construction
rather than by an arbitrary display cap.
