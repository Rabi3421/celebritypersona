import type { Metadata } from "next";
import { site } from "@/lib/site-config";

/**
 * One place that builds the head of every public page.
 *
 * Canonical, Open Graph and Twitter used to be written per route, which meant
 * most routes simply had none: only the outfit pages carried a canonical, so
 * every directory, archive and occasion page shipped without one and without a
 * share card. Google then had to pick a preferred URL for each of them on its
 * own, across two hostnames.
 *
 * Pass a path and this returns the whole set, resolved against `metadataBase`.
 */

/** The share card used when a page has no photo of its own. */
export const DEFAULT_OG_IMAGE = {
  url: "/images/home/celebritypersona-hero-v2.png",
  width: 1672,
  height: 941,
  alt: "CelebrityPersona — Indian celebrity outfits decoded piece by piece",
};

export type SeoInput = {
  /** Shown in the blue link. Kept as given; the site name is appended by the
   *  root template unless `absoluteTitle` is set. */
  title: string;
  description: string;
  /** Site-root-relative, always with a leading slash and never a query. */
  path: string;
  /** Skip the "· CelebrityPersona" suffix, for titles already at full width. */
  absoluteTitle?: boolean;
  /** Photos of the thing this page is about, best first. */
  images?: { url: string; alt?: string }[];
  type?: "website" | "article" | "profile";
  /** Set false for pages that exist for readers but not for the index. */
  index?: boolean;
  publishedTime?: string;
  modifiedTime?: string;
};

export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle,
  images,
  type = "website",
  index = true,
  publishedTime,
  modifiedTime,
}: SeoInput): Metadata {
  const cards = images?.length
    ? images.slice(0, 4).map((image) => ({ url: image.url, alt: image.alt ?? title }))
    : [DEFAULT_OG_IMAGE];

  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    robots: index ? undefined : { index: false, follow: true },
    openGraph: {
      type,
      siteName: site.name,
      locale: "en_IN",
      title,
      description,
      url: path,
      images: cards,
      ...(publishedTime ? { publishedTime } : {}),
      ...(modifiedTime ? { modifiedTime } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: cards.map((card) => card.url),
    },
  };
}

/** Absolute URL for anything that has to be spelled out, such as JSON-LD. */
export const absolute = (path: string) => `${site.url}${path}`;

/**
 * A BreadcrumbList matching the breadcrumb the page actually renders. Google
 * wants the trail visible as well as marked up, so the crumbs passed here are
 * the same ones the header draws.
 */
export function breadcrumbs(id: string, trail: { name: string; path: string }[]) {
  return {
    "@type": "BreadcrumbList",
    "@id": `${id}#breadcrumbs`,
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absolute(crumb.path),
    })),
  };
}

/** Serialises a graph for a single <script type="application/ld+json">. */
export const jsonLd = (graph: object[]) =>
  JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
