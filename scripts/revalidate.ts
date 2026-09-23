/**
 * Tells the live site to refresh after a script has changed the database.
 *
 * The maintenance scripts talk to MongoDB directly, outside Next, so nothing
 * they do invalidates a rendered page. This posts to /api/revalidate, which
 * takes no path and only needs the shared secret.
 *
 * Never throws. A refresh that did not happen is worth a warning, not a failed
 * migration: the data is already written, and the site catches up on its own
 * TTL regardless.
 */
export async function revalidateSite(): Promise<void> {
  const secret = process.env.CRON_SECRET;
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!secret || !base) {
    console.warn(
      "Skipping revalidation: CRON_SECRET and NEXT_PUBLIC_SITE_URL must both be set.\n" +
        "The site will pick these changes up within the hour regardless.",
    );
    return;
  }

  try {
    const response = await fetch(new URL("/api/revalidate", base), {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.warn(`Revalidation returned ${response.status}. The site will catch up on its own TTL.`);
      return;
    }
    console.log("Asked the live site to refresh.");
  } catch (error) {
    const name = error instanceof Error ? error.name : "Error";
    console.warn(`Revalidation request failed (${name}). The site will catch up on its own TTL.`);
  }
}
