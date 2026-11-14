"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { MenuIcon, PanelIcon, CloseIcon } from "./AdminIcons";
import { SIDEBAR_COOKIE, type SidebarMode } from "@/lib/admin-nav";
import styles from "@/app/admin/panel.module.css";

/** Below this the sidebar is a drawer; at or below COMPACT it folds to icons unless the editor chose otherwise. */
const DRAWER = "(max-width: 900px)";
const COMPACT = "(max-width: 1399px)";

function useMedia(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * The grid, the sidebar and the main column.
 *
 * The page itself scrolls; the sidebar sticks beside it. Three widths:
 *   - wide screens: the full sidebar, or icons if the editor folded it;
 *   - narrower laptops (to 1399px): icons by default, so the work gets the room,
 *     unless the editor expanded it — a choice remembered in a cookie, read on
 *     the server so the first paint is already the right width;
 *   - tablets and phones (to 900px): a top bar with a Menu button that opens
 *     the navigation as a drawer, closed by Escape, the backdrop, the close
 *     button or following a link.
 */
export function AdminShell({
  initialMode,
  sidebar,
  children,
}: {
  initialMode: SidebarMode;
  sidebar: ReactNode;
  children: ReactNode;
}) {
  const [mode, setMode] = useState<SidebarMode>(initialMode);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isDrawer = useMedia(DRAWER);
  const isCompact = useMedia(COMPACT);
  const pathname = usePathname();
  const menuButton = useRef<HTMLButtonElement>(null);
  const drawer = useRef<HTMLDivElement>(null);
  const folded = mode === "collapsed" || (mode === "auto" && isCompact);

  function toggle() {
    const next: SidebarMode = folded ? "open" : "collapsed";
    setMode(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next}; path=/admin; max-age=31536000; samesite=lax`;
  }

  const close = useCallback((returnFocus = true) => {
    setDrawerOpen(false);
    if (returnFocus) menuButton.current?.focus();
  }, []);

  // Following a link closes the drawer; so does growing past the drawer width.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setDrawerOpen(false);
  }
  const open = drawerOpen && isDrawer;

  useEffect(() => {
    if (!open) return;
    // Next frame: the drawer has to be visible (no longer inert) to take focus.
    const frame = requestAnimationFrame(() =>
      (drawer.current?.querySelector<HTMLElement>("a[aria-current]") ?? drawer.current?.querySelector<HTMLElement>("a[href]"))?.focus(),
    );
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      // Keep Tab inside the drawer while it covers the page.
      if (event.key === "Tab" && drawer.current) {
        const items = [...drawer.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
        const first = items[0];
        const last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    const scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(frame);
      document.documentElement.style.overflow = scroll;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div
      className={styles.shell}
      data-collapsed={folded || undefined}
      data-sidebar={mode}
      data-drawer={open || undefined}
    >
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
            aria-expanded={!folded}
            aria-label={folded ? "Expand sidebar" : "Collapse sidebar"}
            title={folded ? "Expand sidebar" : "Collapse sidebar"}
          >
            <PanelIcon />
          </button>
          <button
            ref={menuButton}
            type="button"
            className={styles.menuButton}
            onClick={() => (open ? close() : setDrawerOpen(true))}
            aria-expanded={open}
            aria-controls="admin-navigation"
          >
            <MenuIcon />
            <span>Menu</span>
          </button>
        </div>
        <div
          ref={drawer}
          id="admin-navigation"
          className={styles.drawer}
          role={isDrawer ? "dialog" : undefined}
          aria-modal={open || undefined}
          aria-label={isDrawer ? "Admin navigation" : undefined}
          // Closed on a small screen: out of the tab order and the accessibility tree.
          inert={isDrawer && !open}
        >
          <div className={styles.drawerHead}>
            <p className={styles.brand}>
              <i />
              <span>CelebrityPersona</span>
            </p>
            <button type="button" className={styles.fold} onClick={() => close()} aria-label="Close navigation">
              <CloseIcon />
            </button>
          </div>
          {sidebar}
        </div>
      </aside>
      {open ? <div className={styles.scrim} onClick={() => close()} aria-hidden="true" /> : null}

      <div className={styles.main}>{children}</div>
    </div>
  );
}
