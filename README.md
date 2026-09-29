# ANU Discover

ANU Discover is an event feed for students who want to know **which events are
relevant to them**, not an exhaustive listing of everything happening on
campus. Instead of a calendar grid, it's a scannable list of cards you can
narrow by category (Technology & AI, Careers, Research Talks, Arts & Culture,
Social & Wellbeing) and by time (today, this week, the weekend), and save the
ones you care about to a personal My Events list that's still there next time
you visit.

## What good looks like here

The brief asked for one focused slice done well, not a rebuild of the whole ANU
events system — so the scope is deliberately small: browse, filter, save. No
search, no ticketing, no per-event detail pages, no accounts. A card shows
exactly what you need to decide whether to go: title, category, date and time,
location, and a one-line description — nothing denser.

Filtering is a set of plain links (`?category=...&when=...`), not a JS
widget. That was a judgement call, not a requirement: it keeps desktop and
mobile behaviour identical for free, works with JavaScript off, and matches
the "calm, scannable" brief better than a client-side control that has to be
built and tested twice. The category and time filters compose (e.g. Careers +
this week), because a student is usually narrowing on both axes at once.

Saving is a real, persisted action — a `POST` to a small API route that writes
to the same SQLite database the feed reads from, not local state that
disappears on reload. That persistence is enforced: [`spec/crit-7.test.ts`](spec/crit-7.test.ts)
saves an event over HTTP and re-fetches My Events as an independent request to
prove it survived, and removing an event is checked the same way.

What's a judgement call versus what's enforced:

- **Enforced** (`spec/`, CI): the five categories all appear on the unfiltered
  feed, a category filter narrows to only that category, saving and removing
  an event actually persists across requests, and the shared accessibility/
  navigation invariants every deliverable carries.
- **Judgement calls** (not something a test can hold you to): the five
  categories and the today/week/weekend split as *the* useful ways to narrow
  a student's attention; cards over a calendar as the calmer format; and the
  visual design — pill-shaped filter chips, a card grid that reflows instead
  of a fixed table, and a generous line-height — as what "inviting" means for
  this brief.

The ~12 seed events are realistic ANU-style mock data (talks, career fairs,
society socials, research seminars) generated once at first boot — there's no
scraping and no external API, per the brief.
