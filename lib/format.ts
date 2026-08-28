/** Formats a number as Indian rupees with lakh/crore grouping: 443500 -> "₹4,43,500". */
export function inr(value: number): string {
  const digits = String(Math.round(value));
  const last3 = digits.slice(-3);
  let rest = digits.slice(0, -3);
  if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return `₹${rest ? `${rest},` : ""}${last3}`;
}
