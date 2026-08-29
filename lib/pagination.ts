/** Paging maths, kept out of the views so every table behaves the same. */

export const PAGE_SIZES = [10, 25, 50] as const;
export const DEFAULT_PAGE_SIZE = 10;

export type Paged<T> = {
  rows: T[];
  page: number;
  pages: number;
  perPage: number | "all";
  total: number;
  /** 1-indexed, inclusive, for "showing 1 to 10 of 21". */
  from: number;
  to: number;
};

/** Reads a page size from the URL, falling back to the default. */
export function readPerPage(value: string | undefined): number | "all" {
  if (value === "all") return "all";
  const n = Number(value);
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

/** Clamps an out-of-range page rather than showing an empty table. */
export function paginate<T>(
  items: T[],
  requestedPage: string | undefined,
  perPage: number | "all",
): Paged<T> {
  const total = items.length;
  const size = perPage === "all" ? Math.max(total, 1) : perPage;
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, Number(requestedPage) || 1), pages);
  const start = (page - 1) * size;
  const rows = items.slice(start, start + size);

  return {
    rows,
    page,
    pages,
    perPage,
    total,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + size, total),
  };
}

/**
 * The page numbers to show, with gaps once there are too many to list.
 * e.g. 1 … 6 7 [8] 9 10 … 24
 */
export function pageWindow(current: number, pages: number): (number | "gap")[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);

  const out: (number | "gap")[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(pages - 1, current + 1);

  if (start > 2) out.push("gap");
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < pages - 1) out.push("gap");
  out.push(pages);
  return out;
}
