# Crit 7 reflection

**The breakthrough that moved the work forward** was realising that
"categories" was the wrong idea, not just an incomplete one. My first
version had five category filters over an event list. It worked, the checks
were green, but it was still basically what ANU's own events site already
does. Comparing my pages against the real ANU Events site side by side is
what showed me this. That site already lists and searches events. It
doesn't help a student decide what's worth their time this week. That
comparison is what turned category filters into student intents (learn
something, build my career, meet people, try something new, take a break),
and turned a nicer event list into ANU Discover.

The production migration bug reinforced the same lesson from a different
angle. A green local build did not mean the product was actually safe: a
reseed migration deleted events without clearing `saved_events` first,
which would have broken the moment someone saved something. Local state
never exposed that. Only checking the real production database did.

**What this changed about who I want to be as a developer** is that I
stopped trusting the first plausible thing an agent hands back. I now
compare it against the real system it's supposed to improve on, ask whether
it actually solves the student's problem, and check behaviour in the
running app and its real data, not just in a test file. That habit is what
caught both the categorisation problem and the migration risk, and it's the
one I want to keep.
