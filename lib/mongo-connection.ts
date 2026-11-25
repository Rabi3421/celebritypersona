/**
 * One shared connection per process that heals itself.
 *
 * The connection used to be opened once when a server instance started and
 * kept as-is. If that first attempt failed (a brief Atlas hiccup), the failed
 * attempt was kept too, so every request on that instance failed until Vercel
 * replaced it. Now a failed attempt is forgotten: the next request connects
 * again. A successful connection is reused, as before.
 */
export function sharedConnection<T>(connect: () => Promise<T>, remember?: (pending: Promise<T> | undefined) => void, initial?: Promise<T>) {
  let pending: Promise<T> | undefined = initial;
  return function get(): Promise<T> {
    if (pending) return pending;
    const attempt = connect();
    pending = attempt;
    remember?.(attempt);
    // Handled here so a failure is never an "unhandled rejection"; callers still see it.
    attempt.catch(() => {
      if (pending === attempt) {
        pending = undefined;
        remember?.(undefined);
      }
    });
    return attempt;
  };
}
