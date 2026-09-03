import Link from "next/link";
import { legalDocs, type LegalBlock, type LegalDoc } from "@/lib/legal-content";
import { contacts, pending } from "@/lib/site-config";
import styles from "./legal.module.css";

/**
 * A detail row whose value has not been supplied yet is left out entirely,
 * rather than published as an "Add …" chip. The admin Settings page is where
 * the missing ones are listed; a policy page is not the place to show a reader
 * that the publisher's own name has not been filled in.
 */

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "p") return <p>{block.text}</p>;

  if (block.type === "list") {
    return (
      <ul>
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  if (block.type === "note") {
    return (
      <div className={styles.note}>
        <p>{block.text}</p>
      </div>
    );
  }

  const rows = block.rows.filter((row) => !pending(row.value));
  if (rows.length === 0) return null;

  return (
    <dl className={styles.details}>
      {rows
        .map((row) => (
          <div className={styles.detailRow} key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function LegalDocument({ doc }: { doc: LegalDoc }) {
  const siblings = legalDocs.filter((item) => item.slug !== doc.slug);

  return (
    <main className={styles.page}>
      <header className={styles.band}>
        <div className={styles.shell}>
          <nav className={styles.crumb}>
            <Link href="/">Home</Link>
            <i>›</i>
            <span>{doc.title}</span>
          </nav>
          <p className={styles.eyebrow}>{doc.eyebrow}</p>
          <h1>{doc.h1}</h1>
          <p className={styles.lede}>{doc.lede}</p>
          <p className={styles.stamp}>
            Last updated <b>{doc.updated}</b>
          </p>
        </div>
      </header>

      <div className={styles.shell}>
        <div className={styles.layout}>
          <nav className={styles.toc} aria-label="On this page">
            <p>On this page</p>
            {doc.sections.map((section) => (
              <a href={`#${section.id}`} key={section.id}>
                {section.heading}
              </a>
            ))}
          </nav>

          <article className={styles.body}>
            {doc.sections.map((section) => (
              <section className={styles.section} id={section.id} key={section.id}>
                <h2>{section.heading}</h2>
                {section.blocks.map((block, index) => (
                  <Block block={block} key={index} />
                ))}
              </section>
            ))}

            <div className={styles.foot}>
              <span>Questions about this page?</span>
              <a href={`mailto:${contacts.general}`}>{contacts.general}</a>
            </div>
          </article>
        </div>
      </div>

      <div className={styles.shell}>
        <section className={styles.siblings}>
          <p>The rest of the small print</p>
          <div className={styles.siblingGrid}>
            {siblings.map((item) => (
              <Link href={`/${item.slug}`} key={item.slug}>
                <strong>{item.title}</strong>
                <span>{item.lede.split(". ")[0]}.</span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
