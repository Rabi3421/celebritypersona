"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { inr } from "@/lib/format";
import { useSavedList } from "@/lib/saved";
import styles from "@/app/saved/saved.module.css";

/** Just enough of a look to draw its card. The whole archive is handed over so
 *  the page can resolve a browser-held list without a round trip. */
export type SavedLook = {
  slug: string;
  celebrity: string;
  event: string;
  occasion: string;
  date: string;
  photo?: string;
  worn: number | null;
  swap: number | null;
  complete: boolean;
};

export type SavedPerson = {
  slug: string;
  name: string;
  looks: number;
  photo?: string;
};

const shortDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/**
 * Everything the visitor has hearted. The list itself lives in their browser;
 * this page holds the archive and shows the rows that match, newest save first.
 */
export function SavedLibrary({ looks, people }: { looks: SavedLook[]; people: SavedPerson[] }) {
  const savedLooks = useSavedList("looks");
  const savedPeople = useSavedList("people");

  const lookIndex = useMemo(() => new Map(looks.map((look) => [look.slug, look])), [looks]);
  const personIndex = useMemo(() => new Map(people.map((person) => [person.slug, person])), [people]);

  // A look that has since been unpublished simply drops out rather than
  // rendering an empty card or a link to a 404.
  const chosenLooks = savedLooks.items
    .map((slug) => lookIndex.get(slug))
    .filter((look): look is SavedLook => Boolean(look));
  const chosenPeople = savedPeople.items
    .map((slug) => personIndex.get(slug))
    .filter((person): person is SavedPerson => Boolean(person));

  const buyable = chosenLooks.filter((look) => look.complete && look.swap !== null);
  const swapTotal = buyable.reduce((sum, look) => sum + (look.swap ?? 0), 0);
  const wornTotal = buyable.reduce((sum, look) => sum + (look.worn ?? 0), 0);

  // Until the browser list has been read there is nothing truthful to show, so
  // the page holds its shape rather than flashing an empty state at everyone.
  const loading = !savedLooks.ready || !savedPeople.ready;
  const nothingSaved = !loading && chosenLooks.length === 0 && chosenPeople.length === 0;

  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={`${styles.shell} ${styles.bandInner}`}>
          <div>
            <nav className={styles.crumb} aria-label="Breadcrumb">
              <Link href="/">Home</Link>
              <i>›</i>
              <span>Saved</span>
            </nav>
            <h1>Your saved looks</h1>
            <p className={styles.lede}>
              Kept in this browser only. Nothing is sent to us, there is no
              account to make, and clearing your browser data clears this list.
            </p>
          </div>
          {loading ? null : (
            <div className={styles.tally}>
              <div>
                <b>{chosenLooks.length}</b>
                <span>Looks</span>
              </div>
              <div>
                <b>{chosenPeople.length}</b>
                <span>Archives</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <div className={styles.shell}>
        {loading ? (
          <section className={styles.section} aria-busy="true" />
        ) : nothingSaved ? (
          <section className={styles.section}>
            <div className={styles.empty}>
              <span aria-hidden="true">♡</span>
              <h2>Nothing saved yet</h2>
              <p>
                Tap the heart on any look and it lands here. Follow someone and
                their archive is one tap away too.
              </p>
              <Link href="/outfits">Browse every look →</Link>
            </div>
          </section>
        ) : (
          <>
            {chosenLooks.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.heading}>
                  <div>
                    <p>Saved</p>
                    <h2>
                      {chosenLooks.length} {chosenLooks.length === 1 ? "look" : "looks"}
                    </h2>
                  </div>
                  <button type="button" className={styles.clear} onClick={savedLooks.clear}>
                    Clear all
                  </button>
                </div>

                {buyable.length > 0 ? (
                  <div className={styles.total}>
                    <div>
                      <span>
                        Rebuilding {buyable.length} complete{" "}
                        {buyable.length === 1 ? "look" : "looks"} would cost
                      </span>
                      <small>
                        Against {inr(wornTotal)} as worn — a saving of{" "}
                        {inr(wornTotal - swapTotal)}.
                      </small>
                    </div>
                    <b>{inr(swapTotal)}</b>
                  </div>
                ) : null}

                <div className={styles.grid}>
                  {chosenLooks.map((look) => (
                    <article className={styles.card} key={look.slug}>
                      <button
                        type="button"
                        className={styles.heart}
                        onClick={() => savedLooks.remove(look.slug)}
                        aria-label={`Remove ${look.celebrity}, ${look.event} from saved`}
                      >
                        ♥
                      </button>
                      <Link className={styles.cardImage} href={`/outfits/${look.slug}`}>
                        <Image
                          src={look.photo ?? `https://picsum.photos/seed/${look.slug}/600/750`}
                          alt={`${look.celebrity} at ${look.event}`}
                          fill
                          sizes="(max-width: 620px) 50vw, (max-width: 1023px) 33vw, 25vw"
                        />
                        <em>{look.occasion}</em>
                      </Link>
                      <div className={styles.cardBody}>
                        <h3>{look.celebrity}</h3>
                        <p>
                          {look.event} · {shortDate.format(new Date(`${look.date}T00:00:00`))}
                        </p>
                        <p className={styles.prices}>
                          {look.worn === null ? <em>Price unconfirmed</em> : <s>{inr(look.worn)}</s>}
                          {look.swap === null ? <em>No swap yet</em> : <b>{inr(look.swap)}</b>}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {chosenPeople.length > 0 ? (
              <section className={styles.section}>
                <div className={styles.heading}>
                  <div>
                    <p>Following</p>
                    <h2>
                      {chosenPeople.length} {chosenPeople.length === 1 ? "archive" : "archives"}
                    </h2>
                  </div>
                  <button type="button" className={styles.clear} onClick={savedPeople.clear}>
                    Unfollow all
                  </button>
                </div>
                <div className={styles.people}>
                  {chosenPeople.map((person) => (
                    <div className={styles.person} key={person.slug}>
                      <Link href={`/celebrities/${person.slug}`}>
                        <Image
                          src={person.photo ?? `https://picsum.photos/seed/${person.slug}/80/80`}
                          alt=""
                          width={34}
                          height={34}
                        />
                      </Link>
                      <Link href={`/celebrities/${person.slug}`}>
                        <b>{person.name}</b>
                        <span>{person.looks} looks</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => savedPeople.remove(person.slug)}
                        aria-label={`Unfollow ${person.name}`}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

        <p className={styles.note}>
          Saved looks live in this browser&apos;s storage. They will not follow
          you to another device, and a private window forgets them when it closes.
        </p>
      </div>
    </main>
  );
}
