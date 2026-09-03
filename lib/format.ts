/** Formats a number as Indian rupees with lakh/crore grouping: 443500 -> "₹4,43,500". */
export function inr(value: number): string {
  const digits = String(Math.round(value));
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${rest ? `${rest},` : ""}${last3}`;
}

/**
 * "1 look", "3 looks". Counts are read off the archive rather than typed, so
 * they are as often one as many — and a title tag reading "1 looks decoded" is
 * the kind of thing a reader notices before anything else on the page.
 */
export const plural = (count: number, one: string, many = `${one}s`) =>
  `${count} ${count === 1 ? one : many}`;
