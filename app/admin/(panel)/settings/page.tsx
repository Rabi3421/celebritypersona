import { readSession } from "@/lib/auth/session";
import {
  contacts,
  dataProtection,
  grievanceOfficer,
  legalEntity,
  PENDING,
  pending,
  site,
} from "@/lib/site-config";
import styles from "@/app/admin/panel.module.css";

/** Reports whether a secret is configured. Never renders its value. */
function envRows() {
  const mongo = process.env.MONGODB_URI;
  return [
    {
      label: "MONGODB_URI",
      value: mongo
        ? `set · ${mongo.replace(/\/\/[^@]*@/, "//•••@").split("?")[0]}`
        : "not set",
      ok: Boolean(mongo),
    },
    {
      label: "MONGODB_DB",
      value: process.env.MONGODB_DB ?? "not set",
      ok: Boolean(process.env.MONGODB_DB),
    },
    {
      label: "AUTH_SECRET",
      value: process.env.AUTH_SECRET ? "set · value never displayed" : "not set",
      ok: Boolean(process.env.AUTH_SECRET),
    },
    {
      label: "ADMIN_EMAIL",
      value: process.env.ADMIN_EMAIL ?? "not set",
      ok: Boolean(process.env.ADMIN_EMAIL),
    },
    {
      label: "NEXT_PUBLIC_SITE_URL",
      value: process.env.NEXT_PUBLIC_SITE_URL ?? "not set",
      ok: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
    },
    {
      label: "INSTAGRAM_ACCESS_TOKEN",
      value: process.env.INSTAGRAM_ACCESS_TOKEN
        ? "set · reels read live from the account"
        : "not set · reels fall back to the homepage form",
      ok: Boolean(process.env.INSTAGRAM_ACCESS_TOKEN),
    },
  ];
}

const legalRows = [
  { label: "Registered name", value: legalEntity.name },
  { label: "Registered address", value: legalEntity.address },
  { label: "CIN or GST", value: legalEntity.cin },
  { label: "Grievance Officer", value: grievanceOfficer.name },
];

export default async function AdminSettings() {
  const session = await readSession();
  const env = envRows();
  const unfilled = legalRows.filter((row) => pending(row.value)).length;

  return (
    <>
      {unfilled > 0 ? (
        <div className={styles.notice}>
          <strong>
            {unfilled} legal detail{unfilled === 1 ? "" : "s"} still needed
          </strong>
          <p>
            These render as amber placeholders on the public policy pages. The
            Grievance Officer name and an address in India are required by the
            Information Technology Rules, 2021. Edit{" "}
            <code>lib/site-config.ts</code>.
          </p>
        </div>
      ) : null}

      <section>
        <div className={styles.sectionHead}>
          <h2>Environment</h2>
          <span>Values are masked. Secrets are never rendered.</span>
        </div>
        <div className={styles.rows}>
          {env.map((row) => (
            <div className={styles.row} key={row.label}>
              <strong>{row.label}</strong>
              <span>{row.value}</span>
              <span
                className={`${styles.status} ${row.ok ? styles.good : styles.missing}`}
              >
                {row.ok ? "configured" : "missing"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Legal identity</h2>
          <span>Published on the policy pages</span>
        </div>
        <div className={styles.rows}>
          {legalRows.map((row) => (
            <div className={styles.row} key={row.label}>
              <strong>{row.label}</strong>
              <span>
                {pending(row.value)
                  ? `add ${row.value.slice(PENDING.length)}`
                  : row.value}
              </span>
              <span
                className={`${styles.status} ${
                  pending(row.value) ? styles.missing : styles.good
                }`}
              >
                {pending(row.value) ? "needed" : "set"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Access</h2>
          <span>One account, no sign-up, no reset</span>
        </div>
        <div className={styles.rows}>
          <div className={styles.row}>
            <strong>Signed in as</strong>
            <span>{session?.email ?? "unknown"}</span>
            <span className={`${styles.status} ${styles.good}`}>active</span>
          </div>
          <div className={styles.row}>
            <strong>Session length</strong>
            <span>8 hours, then sign in again</span>
            <span className={styles.status}>fixed</span>
          </div>
          <div className={styles.row}>
            <strong>Failed attempt limit</strong>
            <span>5 per 15 minutes, per IP, held in memory</span>
            <span className={styles.status}>fixed</span>
          </div>
          <div className={styles.row}>
            <strong>Change password</strong>
            <span>npm run seed:admin — reads the new password on stdin</span>
            <span className={styles.status}>cli</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Public contacts</h2>
          <span>{site.domain}</span>
        </div>
        <div className={styles.rows}>
          {Object.entries(contacts).map(([key, value]) => (
            <div className={styles.row} key={key}>
              <strong>{key}</strong>
              <span>{value}</span>
              <span className={styles.status}>alias</span>
            </div>
          ))}
          <div className={styles.row}>
            <strong>grievance</strong>
            <span>
              {grievanceOfficer.email} · acknowledged in{" "}
              {grievanceOfficer.acknowledgeWithin}, resolved in{" "}
              {grievanceOfficer.resolveWithin}
            </span>
            <span className={styles.status}>alias</span>
          </div>
          <div className={styles.row}>
            <strong>data protection</strong>
            <span>
              {dataProtection.contact} · {dataProtection.resolveWithin} outer
              limit
            </span>
            <span className={styles.status}>alias</span>
          </div>
        </div>
      </section>
    </>
  );
}
