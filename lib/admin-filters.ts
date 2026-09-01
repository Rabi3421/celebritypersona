/**
 * Shared list-screen filtering.
 *
 * The panel's tables all filter the same way: a free-text search across a few
 * fields, then some exact matches, then a sort. Keeping it here means every
 * screen treats an empty query, an unknown value and a stray capital letter
 * identically, rather than each table inventing its own rules.
 */

/** Case- and space-insensitive substring match across several fields at once. */
export function matchesQuery(query: string | undefined, ...fields: (string | undefined)[]) {
  const needle = query?.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => field?.toLowerCase().includes(needle));
}

/** Exact match, where an empty or unrecognised filter means "everything". */
export function matchesValue(filter: string | undefined, value: string) {
  const wanted = filter?.trim();
  if (!wanted || wanted === "all") return true;
  return wanted.toLowerCase() === value.toLowerCase();
}

/** True when any filter is set, so a screen knows whether to offer Reset. */
export const anyFilter = (query: Record<string, string | undefined>, keys: string[]) =>
  keys.some((key) => {
    const value = query[key]?.trim();
    return Boolean(value) && value !== "all";
  });

/** Only the params worth carrying into a page link. */
export function carry(
  query: Record<string, string | undefined>,
  keys: string[],
): Record<string, string | undefined> {
  return Object.fromEntries(
    keys
      .map((key) => [key, query[key]?.trim()])
      .filter(([, value]) => Boolean(value) && value !== "all"),
  );
}

/** An <option> list with an "everything" row on top. */
export const allOption = (label: string, values: string[]) => [
  { value: "all", label },
  ...values.map((value) => ({ value, label: value })),
];
