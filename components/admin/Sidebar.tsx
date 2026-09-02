"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarIcon,
  GridIcon,
  HangerIcon,
  InboxIcon,
  PersonIcon,
  SlidersIcon,
  TrendIcon,
} from "./AdminIcons";
import {
  adminGroups,
  adminRoutes,
  type AdminCounts,
  type AdminIconKey,
} from "@/lib/admin-nav";
import styles from "@/app/admin/panel.module.css";

const ICONS: Record<AdminIconKey, (props: { className?: string }) => React.ReactElement> = {
  overview: GridIcon,
  outfits: HangerIcon,
  celebrities: PersonIcon,
  occasions: CalendarIcon,
  trending: TrendIcon,
  reports: InboxIcon,
  requests: PersonIcon,
  subscribers: InboxIcon,
  broadcasts: TrendIcon,
  settings: SlidersIcon,
};

export function Sidebar({ counts }: { counts: AdminCounts }) {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Admin sections">
      {adminGroups.map((group) => {
        const items = adminRoutes.filter((route) => route.group === group);
        if (items.length === 0) return null;

        return (
          <div key={group}>
            <p className={styles.group}>{group}</p>
            {items.map((route) => {
              const active =
                route.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(route.href);
              const Icon = ICONS[route.icon];
              const count = route.countKey ? counts[route.countKey] : undefined;

              return (
                <Link
                  href={route.href}
                  key={route.href}
                  className={styles.link}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon />
                  {route.label}
                  {count === undefined ? null : <b>{count}</b>}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
