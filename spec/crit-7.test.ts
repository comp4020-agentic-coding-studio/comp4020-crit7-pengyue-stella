import { describe, expect, inject, it } from "vitest";
import { INTENTS } from "../src/lib/schema";

// Boots the built server with a throwaway database (spec/global-setup.ts),
// so "persists across a reload" here means a real, separate HTTP request —
// not anything held in memory by the test itself.
const baseUrl = inject("baseUrl");

async function post(path: string, body: URLSearchParams): Promise<Response> {
  return fetch(new URL(path, baseUrl), {
    method: "POST",
    body,
    redirect: "manual",
    // Astro's checkOrigin rejects a cross-origin POST by default; fetch()
    // doesn't set this header itself the way a real form submission would.
    headers: { origin: baseUrl },
  });
}

function eventTitles(html: string): string[] {
  return [...html.matchAll(/<h2>([^<]+)<\/h2>/g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

function hasEventCards(html: string): boolean {
  return html.includes('class="event-card"');
}

async function firstUnsavedEventId(intent: string): Promise<number> {
  const html = await (await fetch(new URL(`/?intent=${intent}`, baseUrl))).text();
  const match = html.match(/name="eventId" value="(\d+)"/);
  if (!match) throw new Error(`expected at least one unsaved event card for intent=${intent}`);
  return Number(match[1]);
}

describe("progressive reduction", () => {
  it("shows no events and all five intent choices on the bare discover screen", async () => {
    const html = await (await fetch(new URL("/", baseUrl))).text();
    expect(hasEventCards(html), "the bare screen should ask a question, not show the catalogue").toBe(false);
    for (const option of INTENTS) {
      expect(html, `should offer "${option.label}" as an intent choice`).toContain(`intent=${option.value}`);
    }
  });

  it("narrows to a small, distinct set of events once an intent is chosen", async () => {
    const learnTitles = eventTitles(await (await fetch(new URL("/?intent=learn", baseUrl))).text());
    const careerTitles = eventTitles(await (await fetch(new URL("/?intent=career", baseUrl))).text());

    expect(learnTitles.length, "an intent should show more than nothing").toBeGreaterThan(0);
    expect(learnTitles.length, "progressive reduction: a small set, not the whole catalogue").toBeLessThanOrEqual(4);
    expect(careerTitles.length).toBeGreaterThan(0);
    expect(careerTitles.length).toBeLessThanOrEqual(4);

    const overlap = learnTitles.filter((title) => careerTitles.includes(title));
    expect(overlap, "choosing a different intent should change which events show").toEqual([]);
  });

  it("narrows further with the practical filters (mode, price)", async () => {
    const allLearn = eventTitles(await (await fetch(new URL("/?intent=learn", baseUrl))).text());
    const onlineLearn = eventTitles(await (await fetch(new URL("/?intent=learn&mode=online", baseUrl))).text());
    expect(onlineLearn.length, "an online-only filter should narrow, not just relabel, the set").toBeLessThan(
      allLearn.length,
    );
    expect(onlineLearn.every((title) => allLearn.includes(title))).toBe(true);

    const allMeet = eventTitles(await (await fetch(new URL("/?intent=meet", baseUrl))).text());
    const freeMeet = eventTitles(await (await fetch(new URL("/?intent=meet&free=true", baseUrl))).text());
    expect(freeMeet.length, "a free-only filter should narrow the set").toBeLessThan(allMeet.length);
  });
});

describe("saved events", () => {
  it("saving an event persists it to My Events across a reload", async () => {
    const eventId = await firstUnsavedEventId("learn");

    const res = await post("/api/saved-events", new URLSearchParams({ eventId: String(eventId), returnTo: "/" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/");

    const first = await (await fetch(new URL("/my-events", baseUrl))).text();
    expect(first).toContain(`value="${eventId}"`);

    // A second, independent request — proves the save is in the database,
    // not just something the first response happened to carry.
    const reload = await (await fetch(new URL("/my-events", baseUrl))).text();
    expect(reload).toContain(`value="${eventId}"`);
  });

  it("removing a saved event drops it from My Events", async () => {
    const eventId = await firstUnsavedEventId("learn");
    await post("/api/saved-events", new URLSearchParams({ eventId: String(eventId), returnTo: "/" }));

    const removeRes = await post(
      "/api/saved-events/remove",
      new URLSearchParams({ eventId: String(eventId), returnTo: "/my-events" }),
    );
    expect(removeRes.status).toBe(303);

    const after = await (await fetch(new URL("/my-events", baseUrl))).text();
    expect(after).not.toContain(`value="${eventId}"`);
  });
});
