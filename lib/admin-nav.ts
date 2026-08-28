/**
 * One description of the panel's routes.
 *
 * The sidebar reads it for links, grouping and counts. The header reads it for
 * the breadcrumb, title and standfirst. Adding a screen means adding a row
 * here and a page file, and nothing else.
 */

export type AdminIconKey =
  | "overview"
  | "outfits"
  | "celebrities"
  | "occasions"
  | "trending"
  | "reports"
  | "settings";

export type AdminGroup = "Panel" | "Content" | "Operations" | "System";

export type AdminRoute = {
  href: string;
  /** Sidebar label, and the page heading. */
  label: string;
  icon: AdminIconKey;
  group: AdminGroup;
  /** One short line, shown beside the page name. */
  description: string;
  /** Which count to show beside the sidebar link, if any. */
  countKey?: "outfits" | "celebrities" | "occasions" | "reports";
};

export const adminRoutes: AdminRoute[] = [
  {
    href: "/admin",
    label: "Overview",
    icon: "overview",
    group: "Panel",
    description: "What the public site is serving",
  },
  {
    href: "/admin/outfits",
    label: "Outfits",
    icon: "outfits",
    group: "Content",
    countKey: "outfits",
    description: "Every decoded look, newest first",
  },
  {
    href: "/admin/celebrities",
    label: "Celebrities",
    icon: "celebrities",
    group: "Content",
    countKey: "celebrities",
    description: "Style archives and decode counts",
  },
  {
    href: "/admin/occasions",
    label: "Occasions",
    icon: "occasions",
    group: "Content",
    countKey: "occasions",
    description: "Events, grouped as the site groups them",
  },
  {
    href: "/admin/trending",
    label: "Trending",
    icon: "trending",
    group: "Operations",
    description: "What the public leaderboard publishes",
  },
  {
    href: "/admin/reports",
    label: "Price reports",
    icon: "reports",
    group: "Operations",
    countKey: "reports",
    description: "Wrong prices and dead links from readers",
  },
  {
    href: "/admin/settings",
    label: "Settings",
    icon: "settings",
    group: "System",
    description: "Environment, legal identity and access",
  },
];

export const adminGroups: AdminGroup[] = [
  "Panel",
  "Content",
  "Operations",
  "System",
];

/** Longest matching route, so /admin never wins over /admin/outfits. */
export function findAdminRoute(pathname: string): AdminRoute | undefined {
  return [...adminRoutes]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (route) =>
        pathname === route.href || pathname.startsWith(`${route.href}/`),
    );
}

export type AdminCounts = Partial<Record<NonNullable<AdminRoute["countKey"]>, number>>;
