import Link from "next/link";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import styles from "@/components/editorial/editorial.module.css";

/**
 * What a reader — and a crawler — meets at a URL this site does not serve.
 *
 * Until now there was none, so every retired slug, mistyped name and
 * crawler-guessed address rendered Next's built-in page: no header, no footer,
 * not one link off it, and nothing of this site's own. For a crawler that is a
 * dead end on the exact URLs it visits most often after a rename; for a reader
 * arriving from an old Pinterest pin it is a wall.
 *
 * The markup is the editorial pages' own — the same band, shell, crumb and
 * cards /contact and /about are built from — so it is this site's page rather
 * than a new design, and it carries no CSS of its own.
 *
 * No metadata export: Next marks a rendered 404 `noindex` itself, and the
 * response carries a real 404 status because every route calls `notFound()`
 * before anything streams. Adding a `loading.tsx` to those routes would flip
 * them to a streamed 200 and turn each one into a soft 404, so none exists.
 *
 * Next serves this page down two different paths, and both were checked:
 *  - A URL matching no route at all is answered by the prerendered
 *    `_not-found` page, which carries this markup, the root layout's `lang`
 *    and font classes and the stylesheet in the initial HTML.
 *  - A `notFound()` from inside a matched route — the invalid celebrity,
 *    outfit or occasion slug, which is most 404s this site will serve — is
 *    answered with a real 404 status, `noindex` in the head, and an empty
 *    shell whose RSC payload carries the same tree and a preload hint for the
 *    stylesheet, so a reader gets this page and a crawler gets the 404 and
 *    stops. A segment-level `not-found.tsx` does not change that path; there
 *    is no point adding one per route.
 */

/** Where someone who landed here probably meant to go. */
const ROUTES = [
  {
    tag: "Everything",
    title: "All decoded looks",
    body: "Every outfit we have taken apart, filterable by celebrity, occasion and what it costs to rebuild.",
    action: "Browse outfits →",
    href: "/outfits",
  },
  {
    tag: "By person",
    title: "Celebrity style archives",
    body: "One archive per person: the labels she wears, what her looks cost, and every piece identified.",
    action: "A–Z index →",
    href: "/celebrities",
  },
  {
    tag: "By occasion",
    title: "Sangeet, mehendi, airport, Diwali",
    body: "What to wear to the event you are actually dressing for, taken from looks decoded piece by piece.",
    action: "All occasions →",
    href: "/occasions",
  },
  {
    tag: "By budget",
    title: "Complete looks by what you can spend",
    body: "Start from the number rather than the celebrity. Every piece priced and linked.",
    action: "Shop by budget →",
    href: "/budget",
  },
  {
    tag: "Right now",
    title: "Trending this week",
    body: "The looks people are searching for at the moment, each one decoded.",
    action: "See the leaderboard →",
    href: "/trending",
  },
  {
    tag: "Find it",
    title: "Search the archive",
    body: "A name, an event or a label — searching a brand brings up every look carrying it.",
    action: "Open search →",
    href: "/search",
  },
];

export default function NotFound() {
  return (
    <>
      <Nav />
      <main className={styles.page}>
        <header className={styles.band}>
          <div className={styles.shell}>
            <nav className={styles.crumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <i>›</i>
              <span>Page not found</span>
            </nav>
            <p className={styles.eyebrow}>404</p>
            <h1>This page isn’t here</h1>
            <p className={styles.lede}>
              The address may have changed, or the look may never have been at
              it. Everything the archive does hold is one of these away.
            </p>
          </div>
        </header>

        <div className={styles.shell}>
          <section className={styles.section}>
            <div className={styles.heading}>
              <p>Try instead</p>
              <h2>Where you were probably going</h2>
            </div>
            <div className={styles.cards}>
              {ROUTES.map((route) => (
                <Link href={route.href} className={styles.card} key={route.href}>
                  <span>{route.tag}</span>
                  <h3>{route.title}</h3>
                  <p>{route.body}</p>
                  <em>{route.action}</em>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </main>
      <Footer />
      <MobileTabs />
    </>
  );
}
