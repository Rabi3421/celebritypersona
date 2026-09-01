"use client";

import Link from "next/link";
import { HeartIcon } from "./Icons";
import { useSavedList } from "@/lib/saved";

/**
 * The header's saved counter. Reads the same browser-held list every heart on
 * the site writes to, so the number moves the moment a look is saved. It was a
 * hardcoded 3 on a button that went nowhere.
 *
 * The count is only painted once the list has been read, so a prerendered page
 * never flashes a stale number before hydration.
 */
export function SavedBadge() {
  const saved = useSavedList("looks");
  const label = saved.ready
    ? `Saved looks (${saved.count})`
    : "Saved looks";

  return (
    <Link className="navsave" href="/saved" aria-label={label}>
      <HeartIcon />
      {saved.ready && saved.count > 0 ? (
        <b aria-hidden="true">{saved.count > 99 ? "99+" : saved.count}</b>
      ) : null}
    </Link>
  );
}
