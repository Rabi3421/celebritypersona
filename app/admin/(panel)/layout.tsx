import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { AdminShell } from "@/components/admin/AdminShell";
import { Sidebar } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/auth/admin";
import { idleSeconds } from "@/lib/auth/token";
import { AdminSession } from "@/components/admin/session/AdminSession";
import { SIDEBAR_COOKIE } from "@/lib/admin-nav";
import {
  getCelebrityRequests,
  getCelebrityViews,
  getOccasionViews,
  getAllOutfits,
  getPriceReports,
  getSubscribers,
} from "@/lib/db/content";
import styles from "@/app/admin/panel.module.css";

/**
 * Shell for every signed-in page: sidebar, one shared header, then the page.
 * Sits in a route group so /admin/login, which shares the /admin prefix, stays
 * outside the sidebar and outside the guard.
 *
 * requireAdmin() here is the authoritative check. proxy.ts already redirects
 * signed-out visitors, but that runs before rendering and is optimistic.
 */
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  // The views, not the raw documents, so a sidebar count and the list it opens
  // never disagree: both include names the outfits mention with no record yet.
  const [outfits, celebrities, occasions, priceReports, requests, subscribers, store] =
    await Promise.all([
      getAllOutfits(),
      getCelebrityViews(),
      getOccasionViews(),
      getPriceReports(),
      getCelebrityRequests(),
      getSubscribers(),
      cookies(),
    ]);

  // Often enough that the session is renewed well inside its idle window.
  const heartbeatSeconds = Math.max(15, Math.min(10 * 60, Math.floor(idleSeconds() / 3)));

  return (
    <AdminSession email={session.email} heartbeatSeconds={heartbeatSeconds}>
    <AdminShell
      initialCollapsed={store.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      sidebar={
        <Sidebar
          counts={{
            outfits: outfits.length,
            celebrities: celebrities.length,
            occasions: occasions.length,
            reports: priceReports.length,
            requests: requests.length,
            subscribers: subscribers.filter((row) => row.status === "Active").length,
          }}
        />
      }
    >
      <AdminHeader email={session.email} />
      <div className={styles.body}>{children}</div>
    </AdminShell>
    </AdminSession>
  );
}
