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
    href: "/admin/home",
    label: "Homepage",
    icon: "overview",
    group: "Content",
    description: "Hero, ticker, stats and the editorial tiles",
  },
  {
    href: "/admin/outfits",
    label: "Outfits",
    icon: "outfits",
    group: "Content",
    countKey: "outfits",
    description: "Every decoded look, add, edit or remove",
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

/** Screens reachable from a list rather than the sidebar. */
export const adminDetailRoutes: { href: string; group: AdminGroup; label: string; description: string }[] = [
  { href: "/admin/outfits/new", group: "Content", label: "New outfit", description: "Add a decoded look" },
  { href: "/admin/outfits", group: "Content", label: "Edit outfit", description: "Totals are calculated from the pieces" },
  { href: "/admin/celebrities/new", group: "Content", label: "New celebrity", description: "Add a style archive" },
  { href: "/admin/celebrities", group: "Content", label: "Edit celebrity", description: "Archive details and brands" },
  { href: "/admin/occasions/new", group: "Content", label: "New occasion", description: "Add an event category" },
  { href: "/admin/occasions", group: "Content", label: "Edit occasion", description: "Colours, garments and timing" },
  { href: "/admin/trending/new", group: "Operations", label: "New search term", description: "Add a leaderboard row" },
  { href: "/admin/trending", group: "Operations", label: "Edit search term", description: "Leaderboard row" },
];

export const adminGroups: AdminGroup[] = [
  "Panel",
  "Content",
  "Operations",
  "System",
];

/** Longest matching route, so /admin never wins over /admin/outfits. */
export function findAdminRoute(pathname: string): AdminRoute | undefined {
  const detail = adminDetailRoutes.find((route) =>
    route.href.endsWith("/new")
      ? pathname === route.href
      : pathname.startsWith(`${route.href}/`),
  );
  if (detail) {
    return { ...detail, icon: "overview", countKey: undefined };
  }
  return [...adminRoutes]
    .sort((a, b) => b.href.length - a.href.length)
    .find(
      (route) =>
        pathname === route.href || pathname.startsWith(`${route.href}/`),
    );
}

export type AdminCounts = Partial<Record<NonNullable<AdminRoute["countKey"]>, number>>;
