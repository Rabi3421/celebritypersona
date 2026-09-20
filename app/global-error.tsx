"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application shell failed", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en-IN">
      <body>
        <main style={{ maxWidth: 720, margin: "12vh auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <p style={{ color: "#e0006c", fontWeight: 700 }}>CelebrityPersona</p>
          <h1>We could not load the page.</h1>
          <p>Please try again. No form or purchase was completed while this error was shown.</p>
          <button type="button" onClick={reset} style={{ padding: "12px 18px", marginRight: 12 }}>Try again</button>
          <Link href="/">Go home</Link>
        </main>
      </body>
    </html>
  );
}
