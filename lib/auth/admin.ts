import "server-only";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { adminUsers } from "@/lib/mongodb";
import { readSession, type SessionPayload } from "./session";

/**
 * The only way into the admin panel.
 *
 * Two gates, both of which must pass: the address has to equal ADMIN_EMAIL,
 * and the password has to match the bcrypt hash stored in Mongo. There is no
 * sign-up route, no password reset, and no second account.
 */

/** A real hash of a random string, compared against when no user is found so
 *  that a wrong address and a wrong password take the same time to reject. */
const DECOY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.7XNMBjCPjNBEP7pGRVAqE9YOnvJKTFq";

const normalise = (value: string) => value.trim().toLowerCase();

function isAllowedEmail(email: string): boolean {
  const allowed = process.env.ADMIN_EMAIL;
  if (!allowed) return false;
  return normalise(email) === normalise(allowed);
}

/** Returns the email on success, or null. Never says which half was wrong. */
export async function verifyCredentials(
  email: string,
  password: string,
): Promise<string | null> {
  const allowed = isAllowedEmail(email);

  const user = allowed
    ? await (await adminUsers()).findOne({ email: normalise(email) })
    : null;

  const matches = await bcrypt.compare(password, user?.passwordHash ?? DECOY_HASH);

  if (!allowed || !user || !matches) return null;

  await (await adminUsers()).updateOne(
    { email: user.email },
    { $set: { lastLoginAt: new Date() } },
  );
  return user.email;
}

/** Use at the top of every protected page. Redirects when not signed in. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await readSession();
  if (!session) redirect("/admin/login");
  return session;
}
