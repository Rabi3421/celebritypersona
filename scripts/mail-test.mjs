/**
 * Sends one message through whatever MAIL_ settings are configured, and says
 * exactly what happened.
 *
 * Run with:   npm run mail:test you@example.com
 *
 * Use it after every change to the mail setup — a new server, new credentials,
 * a DNS record that has just propagated. It reports the SMTP conversation
 * rather than swallowing it, so a refusal tells you which part is wrong.
 */
import nodemailer from "nodemailer";

const to = process.argv[2];
if (!to) {
  console.error("Who should I write to?  npm run mail:test you@example.com");
  process.exit(1);
}

const host = process.env.MAIL_HOST;
if (!host) {
  console.error(
    "MAIL_HOST is not set, so there is nothing to test — the site is running dry\n" +
      "and writing its mail to the log instead. Fill in the MAIL_ variables first.",
  );
  process.exit(1);
}

const port = Number(process.env.MAIL_PORT ?? 587);
const from = process.env.MAIL_FROM ?? "CelebrityPersona <looks@celebritypersona.com>";

console.log(`host   ${host}:${port}`);
console.log(`from   ${from}`);
console.log(`to     ${to}`);
console.log(`auth   ${process.env.MAIL_USER ? "username and password" : "none"}\n`);

const post = nodemailer.createTransport({
  host,
  port,
  secure: port === 465,
  auth: process.env.MAIL_USER
    ? { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS ?? "" }
    : undefined,
  connectionTimeout: 15_000,
  logger: true,
});

try {
  await post.verify();
  console.log("\n✓ the server accepted the connection and the credentials\n");
} catch (error) {
  console.error("\n✗ could not connect or sign in:", error.message);
  // Providers that allowlist by IP reject with 525 rather than a wrong-password
  // error, which sends people hunting for a credential problem they do not have.
  if (/unauthorized ip|525/i.test(error.message)) {
    console.error(
      "\nThat is the IP allowlist, not your password — the credentials were\n" +
        "accepted in form and refused by location. Add this machine's address to\n" +
        "the sending account's authorised IPs, and remember that a deployed site\n" +
        "calls from different addresses entirely.",
    );
  } else {
    console.error(
      "\nCommon causes: the port is blocked outbound, the hostname is wrong,\n" +
        "or the username and password are not the SMTP ones.",
    );
  }
  process.exit(1);
}

try {
  const info = await post.sendMail({
    from,
    to,
    subject: "CelebrityPersona mail test",
    text:
      "If you are reading this, sending works.\n\n" +
      "Check the message headers in your mail client: SPF, DKIM and DMARC\n" +
      "should all say pass. In Gmail, use the three-dot menu and 'Show original'.",
  });
  console.log(`\n✓ accepted for delivery — ${info.messageId}`);
  console.log(
    "\nNow open it and check the headers. All three of SPF, DKIM and DMARC\n" +
      "must pass, or bulk mail will be rejected outright.",
  );
} catch (error) {
  console.error("\n✗ the server refused the message:", error.message);
  process.exit(1);
}
