"use client";

import { usePathname } from "next/navigation";
import { signOut } from "@/app/admin/actions";
import { findAdminRoute } from "@/lib/admin-nav";
import styles from "@/app/admin/panel.module.css";

/**
 * The one header every panel screen shares. Pages render only their body.
 *
 * Everything sits on a single line: section, page name, and one short line of
 * context beside it. The page name is the h1, set at breadcrumb size, so the
 * heading semantics survive without repeating the word underneath.
 */
export function AdminHeader({ email }: { email: string }) {
  const pathname = usePathname();
  const route = findAdminRoute(pathname);

  return (
    <header className={styles.head}>
      <div className={styles.crumb}>
        {route ? (
          <>
            <span>{route.group}</span>
            <i aria-hidden="true">·</i>
          </>
        ) : null}
        <h1>{route?.label ?? "Admin"}</h1>
        {route ? <em>{route.description}</em> : null}
      </div>

      <div className={styles.account}>
        <span>{email}</span>
        <form action={signOut}>
          <button className={styles.signout} type="submit">
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
