/**
 * Creates or updates the single admin user.
 *
 * Run with:   npm run seed:admin
 * The password is read from stdin so it never reaches a file or shell history.
 * Re-running it is how you change the password.
 */
import { createInterface } from "node:readline/promises";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB ?? "celebritypersona";
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();

if (!uri) throw new Error("MONGODB_URI is not set.");
if (!email) throw new Error("ADMIN_EMAIL is not set.");

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question(`Password for ${email}: `);
  rl.close();
  return answer;
}

const password = (await readPassword()).trim();
if (password.length < 12) {
  throw new Error("Refusing to set a password shorter than 12 characters.");
}

const client = new MongoClient(uri);
await client.connect();

const users = client.db(dbName).collection("adminUsers");
await users.createIndex({ email: 1 }, { unique: true });

const passwordHash = await bcrypt.hash(password, 12);
const result = await users.updateOne(
  { email },
  {
    $set: { email, passwordHash },
    $setOnInsert: { createdAt: new Date() },
  },
  { upsert: true },
);

// Belt and braces: this panel is for one person, so anything else is removed.
const removed = await users.deleteMany({ email: { $ne: email } });

console.log(result.upsertedCount ? `Created admin ${email}` : `Updated password for ${email}`);
console.log(`Other admin accounts removed: ${removed.deletedCount}`);
console.log(`Total admin users now: ${await users.countDocuments()}`);

await client.close();
