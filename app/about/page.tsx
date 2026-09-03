import type { Metadata } from "next";
import { AboutPage } from "@/components/editorial/AboutPage";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { breadcrumbs, jsonLd, pageMetadata } from "@/lib/seo";
import { site } from "@/lib/site-config";

export const metadata: Metadata = pageMetadata({
  title: "About CelebrityPersona — Who Decodes These Looks",
  description: "Indian fashion media tells you what a celebrity spent. CelebrityPersona tells you what you could spend instead. Who writes it, how a look gets decoded, and how the site is funded.",
  path: "/about",
});

const structuredData = jsonLd([
  {
    "@type": "AboutPage",
    "@id": `${site.url}/about#page`,
    url: `${site.url}/about`,
    isPartOf: { "@id": `${site.url}#website` },
    inLanguage: "en-IN",
    about: { "@id": `${site.url}#organization` },
  },
  breadcrumbs(`${site.url}/about`, [
    { name: "Home", path: "/" },
    { name: "Who we are", path: "/about" },
  ]),
]);

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <Nav />
      <AboutPage />
      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
