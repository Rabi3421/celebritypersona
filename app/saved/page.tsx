import type { Metadata } from "next";
import { SavedLibrary, type SavedLook, type SavedPerson } from "@/components/saved/SavedLibrary";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { celebritySlug, outfitSlug } from "@/lib/slugs";
import { isFullySwapped, outfitPhoto, pricing } from "@/lib/types";
import { getCelebrityViews, getOutfits } from "@/lib/db/content";

export const metadata: Metadata = {
  title: "Saved looks — CelebrityPersona",
  description:
    "The celebrity looks and style archives you have saved, kept in your own browser.",
  // A page whose content differs per visitor and lives only in their browser
  // has nothing for a crawler to index.
  robots: { index: false, follow: true },
};

/**
 * The archive is handed to the client whole and filtered there against the
 * saved list, because that list lives in the visitor's browser and never
 * reaches the server. It is a few dozen rows, so this costs nothing.
 */
export default async function SavedPage() {
  const [outfits, celebrities] = await Promise.all([getOutfits(), getCelebrityViews()]);

  const looks: SavedLook[] = outfits.map((outfit) => {
    const money = pricing(outfit);
    return {
      slug: outfitSlug(outfit),
      celebrity: outfit.celebrity,
      event: outfit.event,
      occasion: outfit.occasion,
      date: outfit.date,
      photo: outfitPhoto(outfit)?.url,
      worn: money.anyPriced ? money.wornTotal : null,
      swap: money.anySwapped ? money.swapTotal : null,
      complete: isFullySwapped(outfit),
    };
  });

  const people: SavedPerson[] = celebrities.map((celebrity) => ({
    slug: celebritySlug(celebrity),
    name: celebrity.name,
    looks: celebrity.stats.looks,
    photo: celebrity.stats.photos[0],
  }));

  return (
    <>
      <Nav />
      <SavedLibrary looks={looks} people={people} />
      <Footer />
      <MobileTabs active="saved" />
      <ScrollEffects />
    </>
  );
}
