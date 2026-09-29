import type { APIRoute } from "astro";
import { saveEvent } from "../../lib/db";

// Astro's `security.checkOrigin` (on by default for server output) already
// rejects a cross-origin POST before this ever runs — see astro.config.ts.
// A plain form POST + 303 redirect back to where the student was is the
// simplest "save" affordance that works with no client JS.
export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const eventId = Number(form.get("eventId"));
  const returnTo = form.get("returnTo");
  const location = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/";

  if (Number.isInteger(eventId)) saveEvent(eventId);

  return new Response(null, { status: 303, headers: { location } });
};
