import { NextResponse } from "next/server";
import { readSession } from "@/lib/auth/session";

/**
 * Google's search suggestions for a phrase, for the keyword box on the outfit
 * form.
 *
 * The endpoint is unofficial and can change or refuse without notice, so this
 * never fails loudly: anything other than a clean answer inside the timeout is
 * an empty list, with a 200, and the form carries on without hints. Signed-in
 * editors only — it is not a public proxy.
 */

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 2500;
const empty = () => NextResponse.json({ suggestions: [] });

export async function GET(request: Request) {
  if (!(await readSession())) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (query.length < 3) return empty();

  try {
    const url = `https://suggestqueries.google.com/complete/search?${new URLSearchParams({
      client: "firefox",
      hl: "en",
      gl: "in",
      q: query,
    })}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!response.ok) return empty();

    // [query, [suggestion, …], …]
    const data: unknown = JSON.parse(await response.text());
    const list = Array.isArray(data) && Array.isArray(data[1]) ? data[1] : [];
    const suggestions = list
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.toLowerCase().trim())
      .filter((value) => value && value !== query.toLowerCase())
      .slice(0, 8);
    return NextResponse.json({ suggestions });
  } catch {
    return empty();
  }
}
