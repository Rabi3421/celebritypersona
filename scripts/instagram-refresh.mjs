/**
 * Extends the Instagram long-lived token by another 60 days.
 *
 * Run with:   npm run instagram:refresh
 * Then paste the token it prints into .env.local and into the deploy
 * environment. A token can only be refreshed while it is still valid and at
 * least 24 hours old, so run this monthly — once it lapses the only way back
 * is a fresh authorisation in the Meta app.
 */
const token = process.env.INSTAGRAM_ACCESS_TOKEN;

if (!token) {
  console.error("INSTAGRAM_ACCESS_TOKEN is not set. Nothing to refresh.");
  process.exit(1);
}

const url = new URL("https://graph.instagram.com/refresh_access_token");
url.searchParams.set("grant_type", "ig_refresh_token");
url.searchParams.set("access_token", token);

const response = await fetch(url);
const body = await response.json();

if (!response.ok) {
  console.error(`Refresh failed (${response.status}):`, JSON.stringify(body, null, 2));
  console.error(
    "\nIf this says the session is invalid, the token has lapsed. Re-authorise\n" +
      "the app in the Meta dashboard and exchange for a new long-lived token.",
  );
  process.exit(1);
}

const days = Math.round((body.expires_in ?? 0) / 86_400);
const until = new Date(Date.now() + (body.expires_in ?? 0) * 1000);

console.log("\nINSTAGRAM_ACCESS_TOKEN=\"" + body.access_token + "\"\n");
console.log(`Valid for ${days} days, until ${until.toDateString()}.`);
console.log("Paste it into .env.local and your deploy environment.");
