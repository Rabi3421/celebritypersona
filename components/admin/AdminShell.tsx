"use client";

import { useState, type ReactNode } from "react";
import { PanelIcon } from "./AdminIcons";
import { SIDEBAR_COOKIE } from "@/lib/admin-nav";
import styles from "@/app/admin/panel.module.css";

/**
 * The grid, the sidebar and the main column, with the one piece of client
 * state the shell owns: whether the sidebar is folded down to its icons.
 *
 * The choice lives in a cookie rather than localStorage so the layout can read
 * it on the server and render the right width first, with no flash of the
 * wide sidebar before it snaps shut.
 */
export function AdminShell({
  initialCollapsed,
  sidebar,
  children,
}: {
  initialCollapsed: boolean;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/admin; max-age=31536000; samesite=lax`;
  }

  return (
    <div className={styles.shell} data-collapsed={collapsed || undefined}>
      <aside className={styles.side}>
        <div className={styles.brandRow}>
          <p className={styles.brand}>
            <i />
            <span>CelebrityPersona</span>
          </p>
          <button
            type="button"
            className={styles.fold}
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelIcon />
          </button>
        </div>
        {sidebar}
      </aside>

      <div className={styles.main}>{children}</div>
    </div>
  );
}
