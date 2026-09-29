import type { APIRoute } from "astro";
import { removeSavedEvent } from "../../../lib/db";

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const eventId = Number(form.get("eventId"));
  const returnTo = form.get("returnTo");
  const location = typeof returnTo === "string" && returnTo.startsWith("/") ? returnTo : "/";

  if (Number.isInteger(eventId)) removeSavedEvent(eventId);

  return new Response(null, { status: 303, headers: { location } });
};
