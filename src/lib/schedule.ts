// Range helpers for the three time filters. Boundaries are produced as ISO
// strings so they compare directly against schema.events.startsAt (also ISO
// text) — no date library needed for ranges this simple.
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Range {
  start: Date;
  end: Date;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY_MS);
}

export function todayRange(now: Date = new Date()): Range {
  const start = startOfDay(now);
  return { start, end: addDays(start, 1) };
}

export function thisWeekRange(now: Date = new Date()): Range {
  const start = startOfDay(now);
  return { start, end: addDays(start, 7) };
}

// The nearest Saturday–Monday window: today's weekend if today is Sat/Sun,
// otherwise the coming one.
export function weekendRange(now: Date = new Date()): Range {
  const start = startOfDay(now);
  const dow = start.getDay(); // 0 Sun .. 6 Sat
  const toSaturday = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
  const saturday = addDays(start, toSaturday);
  return { start: saturday, end: addDays(saturday, 2) };
}
