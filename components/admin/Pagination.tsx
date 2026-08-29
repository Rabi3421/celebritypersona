import Link from "next/link";
import { PAGE_SIZES, pageWindow, type Paged } from "@/lib/pagination";
import styles from "@/app/admin/panel.module.css";

/** First, previous, next and last. A dead end renders as text, not a link. */
function Step({
  href,
  disabled,
  children,
  title,
}: {
  href: string;
  disabled: boolean;
  children: string;
  title: string;
}) {
  if (disabled) {
    return (
      <span className={`${styles.pageStep} ${styles.pageOff}`} aria-hidden="true">
        {children}
      </span>
    );
  }
  return (
    <Link className={styles.pageStep} href={href} aria-label={title}>
      {children}
    </Link>
  );
}

/**
 * Paging as plain links, so it works without JavaScript, survives a refresh
 * and can be shared or bookmarked. Any other query the page uses is carried
 * through untouched.
 */
export function Pagination<T>({
  paged,
  basePath,
  params = {},
  label = "rows",
}: {
  paged: Paged<T>;
  basePath: string;
  params?: Record<string, string | undefined>;
  label?: string;
}) {
  const { page, pages, perPage, total, from, to } = paged;

  const href = (next: { page?: number | null; per?: string | null }) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    const nextPage = next.page === undefined ? page : next.page;
    const nextPer = next.per === undefined ? String(perPage) : next.per;
    if (nextPage && nextPage > 1) query.set("page", String(nextPage));
    if (nextPer && nextPer !== "10") query.set("per", nextPer);
    const q = query.toString();
    return q ? `${basePath}?${q}` : basePath;
  };

  return (
    <nav className={styles.pager} aria-label="Pagination">
      <p className={styles.pageCount}>
        {total === 0
          ? `No ${label}`
          : `Showing ${from}–${to} of ${total} ${label}`}
      </p>

      {pages > 1 ? (
        <div className={styles.pageLinks}>
          <Step href={href({ page: 1 })} disabled={page === 1} title="First page">
            ‹‹
          </Step>
          <Step href={href({ page: page - 1 })} disabled={page === 1} title="Previous page">
            ‹
          </Step>

          {pageWindow(page, pages).map((entry, index) =>
            entry === "gap" ? (
              <span className={styles.pageGap} key={`gap-${index}`}>
                …
              </span>
            ) : entry === page ? (
              <span
                className={`${styles.pageNum} ${styles.pageNow}`}
                key={entry}
                aria-current="page"
              >
                {entry}
              </span>
            ) : (
              <Link
                className={styles.pageNum}
                href={href({ page: entry })}
                key={entry}
                aria-label={`Page ${entry}`}
              >
                {entry}
              </Link>
            ),
          )}

          <Step href={href({ page: page + 1 })} disabled={page === pages} title="Next page">
            ›
          </Step>
          <Step href={href({ page: pages })} disabled={page === pages} title="Last page">
            ››
          </Step>
        </div>
      ) : null}

      <div className={styles.pageSize}>
        <span>Rows</span>
        {[...PAGE_SIZES, "all" as const].map((size) => {
          const value = String(size);
          const active = String(perPage) === value;
          return active ? (
            <span className={`${styles.pageNum} ${styles.pageNow}`} key={value}>
              {size === "all" ? "All" : size}
            </span>
          ) : (
            <Link
              className={styles.pageNum}
              href={href({ page: 1, per: value })}
              key={value}
            >
              {size === "all" ? "All" : size}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
