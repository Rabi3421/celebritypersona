import type { ReactNode } from "react";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Sidebar } from "@/components/admin/Sidebar";
import { requireAdmin } from "@/lib/auth/admin";
import {
  getCelebrityRequests,
  getCelebrityViews,
  getOccasionViews,
  getOutfits,
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
  const [outfits, celebrities, occasions, priceReports, requests, subscribers] =
    await Promise.all([
      getOutfits(),
      getCelebrityViews(),
      getOccasionViews(),
      getPriceReports(),
      getCelebrityRequests(),
      getSubscribers(),
    ]);

  return (
    <div className={styles.shell}>
      <aside className={styles.side}>
        <p className={styles.brand}>
          <i />
          CelebrityPersona
        </p>
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
      </aside>

      <div className={styles.main}>
        <AdminHeader email={session.email} />
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
