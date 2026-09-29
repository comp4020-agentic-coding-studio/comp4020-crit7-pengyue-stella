import { describe, expect, inject, it } from "vitest";
import { CATEGORIES } from "../src/lib/schema";

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

function eventCategories(html: string): string[] {
  return [...html.matchAll(/class="event-category">([^<]+)</g)].map((m) => m[1].replace(/&amp;/g, "&"));
}

async function firstUnsavedEventId(): Promise<number> {
  const html = await (await fetch(new URL("/", baseUrl))).text();
  const match = html.match(/name="eventId" value="(\d+)"/);
  if (!match) throw new Error("expected at least one unsaved event card on /");
  return Number(match[1]);
}

describe("discover feed", () => {
  it("shows all five categories on the unfiltered feed", async () => {
    const html = await (await fetch(new URL("/", baseUrl))).text();
    const shown = new Set(eventCategories(html));
    for (const category of CATEGORIES) {
      expect(shown.has(category), `${category} should appear on the unfiltered feed`).toBe(true);
    }
  });

  it("narrows to a single category when filtered", async () => {
    const html = await (await fetch(new URL("/?category=Careers", baseUrl))).text();
    const shown = new Set(eventCategories(html));
    expect(shown.size, "filtering to Careers should still show events").toBeGreaterThan(0);
    expect([...shown]).toEqual(["Careers"]);
  });
});

describe("saved events", () => {
  it("saving an event persists it to My Events across a reload", async () => {
    const eventId = await firstUnsavedEventId();

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
    const eventId = await firstUnsavedEventId();
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
