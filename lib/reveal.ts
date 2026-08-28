/** Reveal class for the nth item in a group: `rv rv-d1` … `rv rv-d6`. */
export function revealClass(index: number, max = 6): string {
  return `rv rv-d${(index % max) + 1}`;
}
