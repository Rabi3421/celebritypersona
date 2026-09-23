import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { getPublishedOutfits } from "@/lib/db/content";
import { archiveTotals } from "@/lib/archive";
import { plural } from "@/lib/format";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { author, contacts, pending, site } from "@/lib/site-config";
import styles from "@/components/editorial/editorial.module.css";

/**
 * Who decodes these looks.
 *
 * Google asks who wrote a page and whether they are worth believing; every
 * outfit page carries an `author` and this is where it points. It used to
 * point at /about, which is about the site rather than the person.
 *
 * Everything here is either counted from the archive or supplied by the person
 * themselves. The biography is PENDING until a real one is written, and the
 * page simply leaves that paragraph out rather than filling it — an author box
 * is an argument that somebody is worth believing, which makes it the worst
 * place on the site to invent anything.
 */
export const metadata: Metadata = pageMetadata({
  title: `${author.name} — ${author.role}, ${site.name}`,
  description: `Who decodes the looks on ${site.name}: how each piece is identified, priced and matched to an alternative, and how to send a correction.`,
  path: author.path,
  type: "profile",
});

export const revalidate = 3600;

export default async function AuthorPage() {
  const outfits = await getPublishedOutfits();
  const totals = archiveTotals(outfits);
  const canonical = `${site.url}${author.path}`;

  const structuredData = jsonLd([
    {
      "@type": "ProfilePage",
      "@id": `${canonical}#page`,
      url: canonical,
      isPartOf: { "@id": `${site.url}#website` },
      inLanguage: "en-IN",
      mainEntity: {
        "@type": "Person",
        "@id": `${site.url}#author`,
        name: author.name,
        jobTitle: author.role,
        url: canonical,
        // Only what is real: no description until one is written, and no
        // sameAs until there are profiles to point at.
        ...(pending(author.bio) ? {} : { description: author.bio }),
        ...(author.sameAs.length ? { sameAs: author.sameAs } : {}),
        worksFor: { "@id": `${site.url}#organization` },
      },
    },
    breadcrumbs(canonical, [
      { name: "Home", path: "/" },
      { name: author.name, path: author.path },
    ]),
  ]);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <Nav />
      <main className={styles.page}>
        <header className={styles.band}>
          <div className={styles.shell}>
            <nav className={styles.crumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <i>›</i>
              <span>{author.name}</span>
            </nav>
            <p className={styles.eyebrow}>{author.role}</p>
            <h1>{author.name}</h1>
            <p className={styles.lede}>
              Every look on this site is decoded by hand — {plural(totals.looks, "look")} so
              far, {plural(totals.pieces, "piece")} identified one at a time. Nothing here is
              scraped, and nothing is published that could not be checked.
            </p>
          </div>
        </header>

        <div className={styles.shell}>
          {pending(author.bio) ? null : (
            <section className={styles.section}>
              <p className={styles.prose}>{author.bio}</p>
            </section>
          )}

          <section className={styles.section}>
            <div className={styles.heading}>
              <p>The method</p>
              <h2>How a look gets decoded</h2>
            </div>
            <p className={styles.prose}>
              A person looks at the photograph and works out what each piece is, finds the
              closest thing you can actually buy, and records when the prices were last
              checked. Where a label cannot be confirmed it is marked unidentified and left
              there. <Link href="/how-we-work">The full method is written up here →</Link>
            </p>
          </section>

          <section className={styles.section}>
            <div className={styles.heading}>
              <p>Corrections</p>
              <h2>Tell me when this is wrong</h2>
            </div>
            <p className={styles.prose}>
              Prices move and shops run out. If something here is wrong,{" "}
              <Link href="/report-a-price">report it</Link> or write to{" "}
              <a href={`mailto:${contacts.corrections}`}>{contacts.corrections}</a> — every
              correction is logged on <Link href="/corrections">the corrections page</Link>.
            </p>
          </section>
        </div>
      </main>
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
