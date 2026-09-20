"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Public route failed", error.digest ?? error.message);
  }, [error]);

  return (
    <main className="route-error">
      <p>Something went wrong</p>
      <h1>That page did not load.</h1>
      <span>The archive is still here. Try the page again, or return to the homepage.</span>
      <div>
        <button type="button" onClick={reset}>Try again</button>
        <Link href="/">Go home</Link>
      </div>
    </main>
  );
}
