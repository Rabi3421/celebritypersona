import Link from "next/link";
import { outfitSlug } from "@/lib/slugs";
import styles from "@/app/admin/panel.module.css";
import { getOutfits } from "@/lib/db/content";
import { ListFilters } from "@/components/admin/ListFilters";
import { Pagination } from "@/components/admin/Pagination";
import { paginate, readPerPage } from "@/lib/pagination";
import { allOption, anyFilter, carry, matchesQuery, matchesValue } from "@/lib/admin-filters";
import { celebrityNames, isNewLook, occasionNames } from "@/lib/archive";
import { outfitPhotos, pricing, type Outfit } from "@/lib/types";

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

type Query = {
  page?: string;
  per?: string;
  q?: string;
  occasion?: string;
  celebrity?: string;
  state?: string;
  sort?: string;
};

const FILTER_KEYS = ["q", "occasion", "celebrity", "state", "sort"];

/** The states worth pulling a list down to when working through a backlog. */
const STATES = [
  { value: "all", label: "Any state" },
  { value: "complete", label: "Ready — every piece swapped" },
  { value: "needs-swap", label: "Needs a swap" },
  { value: "needs-price", label: "Missing a worn price" },
  { value: "needs-photo", label: "No photo" },
  { value: "needs-notes", label: "No editor's note" },
];

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "saving", label: "Biggest saving" },
  { value: "priciest", label: "Priciest as worn" },
  { value: "celebrity", label: "Celebrity A–Z" },
];

function inState(outfit: Outfit, state: string | undefined) {
  const money = pricing(outfit);
  switch (state) {
    case "complete":
      return money.allSwapped;
    case "needs-swap":
      return !money.allSwapped;
    case "needs-price":
      return !money.allPriced;
    case "needs-photo":
      return outfitPhotos(outfit).length === 0;
    case "needs-notes":
      return !outfit.notes?.length;
    default:
      return true;
  }
}

export default async function AdminOutfits({
  searchParams,
}: {
  searchParams: Promise<Query>;
}) {
  const [outfits, query] = await Promise.all([getOutfits(), searchParams]);

  // Search reaches into the pieces too, so "Bottega" finds the look that
  // carries the bag rather than nothing at all.
  const filtered = outfits.filter(
    (outfit) =>
      matchesQuery(
        query.q,
        outfit.celebrity,
        outfit.event,
        outfit.occasion,
        outfitSlug(outfit),
        ...outfit.items.flatMap((item) => [item.name, item.wornBrand, item.swapBrand]),
      ) &&
      matchesValue(query.occasion, outfit.occasion) &&
      matchesValue(query.celebrity, outfit.celebrity) &&
      inState(outfit, query.state),
  );

  const sorted = [...filtered].sort((a, b) => {
    switch (query.sort) {
      case "oldest":
        return a.date.localeCompare(b.date);
      case "saving":
        return pricing(b).savingTotal - pricing(a).savingTotal;
      case "priciest":
        return pricing(b).wornTotal - pricing(a).wornTotal;
      case "celebrity":
        return a.celebrity.localeCompare(b.celebrity) || b.date.localeCompare(a.date);
      default:
        return b.date.localeCompare(a.date);
    }
  });

  const paged = paginate(sorted, query.page, readPerPage(query.per));
  const active = anyFilter(query, FILTER_KEYS);

  return (
    <>
      <div className={styles.listTop}>
        <p>
          {active
            ? `${paged.total} of ${outfits.length} looks match.`
            : `${paged.total} decoded looks, newest first.`}
        </p>
        <Link className={styles.newButton} href="/admin/outfits/new">
          New outfit
        </Link>
      </div>

      <ListFilters
        action="/admin/outfits"
        active={active}
        fields={[
          {
            kind: "search",
            name: "q",
            label: "Search",
            value: query.q,
            placeholder: "Celebrity, event, slug, piece or brand",
          },
          {
            kind: "select",
            name: "celebrity",
            label: "Celebrity",
            value: query.celebrity,
            options: allOption("Everyone", celebrityNames(outfits)),
          },
          {
            kind: "select",
            name: "occasion",
            label: "Occasion",
            value: query.occasion,
            options: allOption("Any occasion", occasionNames(outfits)),
          },
          { kind: "select", name: "state", label: "State", value: query.state, options: STATES },
          { kind: "select", name: "sort", label: "Sort", value: query.sort, options: SORTS },
        ]}
      />

      {paged.total === 0 ? (
        <div className={styles.empty}>
          <strong>{outfits.length === 0 ? "No looks yet" : "Nothing matches those filters"}</strong>
          <p>
            {outfits.length === 0 ? (
              <>
                Every count, price and tile on the public site is built from
                these looks, so the site stays empty until the first one is
                published.{" "}
                <Link href="/admin/outfits/new">Add the first look →</Link>
              </>
            ) : (
              <>
                Try a broader search, or <Link href="/admin/outfits">clear the filters</Link>.
              </>
            )}
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.scroll}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Celebrity</th>
                  <th>Event</th>
                  <th>Occasion</th>
                  <th>Date</th>
                  <th>Pieces</th>
                  <th>As worn</th>
                  <th>Swap</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {paged.rows.map((outfit) => {
                  const money = pricing(outfit);
                  const pending = money.pieces - money.swapped;
                  const photos = outfitPhotos(outfit).length;
                  return (
                    <tr key={outfit.id}>
                      <td>
                        {outfit.celebrity}
                        {isNewLook(outfit) ? (
                          <> <span className={`${styles.chip} ${styles.new}`}>New</span></>
                        ) : null}
                        {photos === 0 ? (
                          <> <span className={styles.chip}>no photo</span></>
                        ) : null}
                      </td>
                      <td className={styles.muted}>{outfit.event}</td>
                      <td>
                        <span className={styles.chip}>{outfit.occasion}</span>
                      </td>
                      <td className={`${styles.num} ${styles.muted}`}>{outfit.date}</td>
                      <td className={styles.num}>
                        {money.pieces}
                        {pending > 0 ? (
                          <> <span className={styles.chip}>{pending} pending</span></>
                        ) : null}
                      </td>
                      {/* Only strike a figure the swap actually replaces. */}
                      <td
                        className={`${styles.num} ${
                          money.allSwapped && money.anyPriced ? styles.strike : styles.muted
                        }`}
                      >
                        {money.anyPriced ? inr.format(money.wornTotal) : "Unconfirmed"}
                        {money.anyPriced && !money.allPriced ? (
                          <> <span className={styles.chip}>{money.priced} of {money.pieces} priced</span></>
                        ) : null}
                      </td>
                      <td className={styles.num}>
                        {money.anySwapped ? (
                          <span className={styles.swapCell}>
                            <b className={styles.save}>{inr.format(money.swapTotal)}</b>
                            {money.savingPct === null ? null : (
                              <small>{money.savingPct}% less</small>
                            )}
                          </span>
                        ) : (
                          <span className={`${styles.muted} ${styles.swapCell}`}>None yet</span>
                        )}
                      </td>
                      <td className={styles.num}>
                        <span className={styles.rowActions}>
                          <Link href={`/admin/outfits/${outfit.id}`}>Edit</Link>
                          <Link href={`/outfits/${outfitSlug(outfit)}`} target="_blank">
                            View ↗
                          </Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Pagination
        paged={paged}
        basePath="/admin/outfits"
        params={carry(query, FILTER_KEYS)}
        label="looks"
      />
    </>
  );
}
