import Link from "next/link";
import { Pending } from "./Pending";
import {
  contacts,
  dataProtection,
  grievanceOfficer,
  legalEntity,
} from "@/lib/site-config";
import styles from "./editorial.module.css";

const routes = [
  {
    tag: "Fastest",
    title: "A wrong price or dead link",
    body: "Use the report form. It reaches the person who maintains that outfit page directly, and it is the quickest way to get something fixed.",
    action: "Report a price →",
    href: "/report-a-price",
  },
  {
    tag: "Editorial",
    title: "A correction or a story tip",
    body: "Wrong brand, wrong attribution, or a look you think we should decode next.",
    action: contacts.corrections,
    href: `mailto:${contacts.corrections}`,
  },
  {
    tag: "Rights",
    title: "Copyright and photographs",
    body: "If you own an image we have used, or represent someone in one, this is the route. Read the takedown process first.",
    action: contacts.copyright,
    href: `mailto:${contacts.copyright}`,
  },
  {
    tag: "Privacy",
    title: "Your personal data",
    body: "Access, correction, erasure, or withdrawing consent for updates. Answered within the DPDP timeline.",
    action: dataProtection.contact,
    href: `mailto:${dataProtection.contact}`,
  },
  {
    tag: "Commercial",
    title: "Brands and partnerships",
    body: "Worth knowing up front: you cannot buy a swap placement or a mention. Everything else is open to discussion.",
    action: contacts.partnerships,
    href: `mailto:${contacts.partnerships}`,
  },
  {
    tag: "Anything else",
    title: "General enquiries",
    body: "Not sure which of the above fits? Send it here and we will route it.",
    action: contacts.general,
    href: `mailto:${contacts.general}`,
  },
];

export function ContactPage() {
  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb}>
            <Link href="/">Home</Link>
            <i>›</i>
            <span>Contact</span>
          </nav>
          <p className={styles.eyebrow}>Contact</p>
          <h1>Get hold of a person</h1>
          <p className={styles.lede}>
            Six routes, each going somewhere different. Picking the right one
            gets you a faster answer than a general enquiry will.
          </p>
        </div>
      </header>

      <div className={styles.shell}>
        <section className={styles.section}>
          <div className={styles.cards}>
            {routes.map((route) =>
              route.href.startsWith("/") ? (
                <Link href={route.href} className={styles.card} key={route.title}>
                  <span>{route.tag}</span>
                  <h3>{route.title}</h3>
                  <p>{route.body}</p>
                  <em>{route.action}</em>
                </Link>
              ) : (
                <a href={route.href} className={styles.card} key={route.title}>
                  <span>{route.tag}</span>
                  <h3>{route.title}</h3>
                  <p>{route.body}</p>
                  <em>{route.action}</em>
                </a>
              ),
            )}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.callout}>
            <h2>Grievance Officer</h2>
            <p>
              Published as required by the Information Technology Rules, 2021.
              Any complaint about content on this site reaches a named person,
              gets acknowledged within {grievanceOfficer.acknowledgeWithin}, and
              is resolved within {grievanceOfficer.resolveWithin}. Data
              protection complaints under the DPDP Act run to a{" "}
              {dataProtection.resolveWithin} outer limit and can be escalated to
              the {dataProtection.board}.
            </p>
            <dl className={styles.calloutRows}>
              <div>
                <dt>Name</dt>
                <dd>
                  <Pending value={grievanceOfficer.name} />
                </dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{grievanceOfficer.email}</dd>
              </div>
              <div>
                <dt>Published by</dt>
                <dd>
                  <Pending value={legalEntity.name} />
                </dd>
              </div>
              <div>
                <dt>Registered address</dt>
                <dd>
                  <Pending value={legalEntity.address} />
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </main>
  );
}
