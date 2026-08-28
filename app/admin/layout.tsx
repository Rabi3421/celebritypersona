import type { Metadata } from "next";

/** Keeps the whole panel out of search indexes. The proxy sets the matching
 *  X-Robots-Tag header, so this holds even for responses it never renders. */
export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
