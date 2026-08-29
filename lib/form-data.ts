/** Turns the flat FormData a browser posts back into nested objects. */

export const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();

export const flag = (form: FormData, key: string) => form.get(key) === "on";

/** Splits a textarea into trimmed, non-empty lines. */
export const lines = (form: FormData, key: string) =>
  text(form, key)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** Splits a comma-separated field. */
export const csv = (form: FormData, key: string) =>
  text(form, key)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

/**
 * Collects repeated rows posted as `items.0.name`, `items.1.name` and so on,
 * skipping any row the user left completely blank.
 */
/** Fields whose leading or trailing spaces are meaningful, such as a stat
 *  suffix rendered directly after a number. */
export function rows(
  form: FormData,
  prefix: string,
  fields: string[],
  keepSpaces: string[] = [],
) {
  const indexes = new Set<number>();
  for (const key of form.keys()) {
    const match = key.match(new RegExp(`^${prefix}\\.(\\d+)\\.`));
    if (match) indexes.add(Number(match[1]));
  }
  return [...indexes]
    .sort((a, b) => a - b)
    .map((i) =>
      Object.fromEntries(
        fields.map((f) => [
          f,
          keepSpaces.includes(f)
            ? String(form.get(`${prefix}.${i}.${f}`) ?? "")
            : text(form, `${prefix}.${i}.${f}`),
        ]),
      ),
    )
    .filter((row) => Object.values(row).some((value) => value !== ""));
}
