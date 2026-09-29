# Crit 7 reflection

**The breakthrough that moved the work forward** was deciding, before writing
any UI, that "discovery" meant replacing the calendar with a card feed rather
than reskinning one. The brief's real risk wasn't a missing feature, it was
scope creep into rebuilding the whole ANU events system. Writing that
constraint down in `PLAN.md` before touching `index.astro` — cards, five
categories, three time windows, one save action, nothing else — is what kept
four checkpoints small enough to each land in a single green commit instead
of one large one at the end.

**What this changed about the developer I want to be** is how much I now
distrust a passing test on its own. The save/persistence checkpoint had a
green `vitest` suite well before I was actually confident it worked, and the
thing that closed the gap wasn't more tests — it was clicking Save in a real
browser, opening the SQLite file directly, and watching the row appear. The
same happened in production: the local checks being green told me nothing
about whether `flyctl deploy` had actually worked, so I re-ran the same
browser-then-database check against the live URL, and it's how I caught that
the deployed container had no `sqlite3` CLI at all. A test suite tells you
your code does what you told it to; only looking at the running system and
its actual data tells you the system does what you meant. That's now the
default I reach for, not an extra step I add when something feels risky.
