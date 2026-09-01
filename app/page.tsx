import { BrandMarquee } from "@/components/home/BrandMarquee";
import { Budget } from "@/components/home/Budget";
import { Campaign } from "@/components/home/Campaign";
import { Celebrities } from "@/components/home/Celebrities";
import { DecodedThisWeek } from "@/components/home/DecodedThisWeek";
import { DupeOfTheWeek } from "@/components/home/DupeOfTheWeek";
import { HeroShowcase } from "@/components/home/HeroShowcase";
import { Occasions } from "@/components/home/Occasions";
import { Reels } from "@/components/home/Reels";
import { Signup } from "@/components/home/Signup";
import { Stats } from "@/components/home/Stats";
import { SwapDemo } from "@/components/home/SwapDemo";
import { Trending } from "@/components/home/Trending";
import { Trust } from "@/components/home/Trust";
import { Footer } from "@/components/site/Footer";
import { MobileTabs } from "@/components/site/MobileTabs";
import { Nav } from "@/components/site/Nav";
import { ScrollEffects } from "@/components/site/ScrollEffects";
import { Ticker } from "@/components/site/Ticker";
import { heroLook, homeStats, looksInGroup } from "@/lib/archive";
import { getHomeContent, getOccasions, getOutfits } from "@/lib/db/content";

/** The rail labels looks "2 days ago", so a page prerendered once and never
 *  rebuilt would keep saying it. An hour is finer than the labels' own
 *  resolution, and content edits still revalidate immediately. */
export const revalidate = 3600;

export default async function Home() {
  const [{ swapSteps, campaign }, outfits, occasions] = await Promise.all([
    getHomeContent(),
    getOutfits(),
    getOccasions(),
  ]);

  // The demo needs a look with two sides priced. Until one exists the section
  // is left out rather than animated against invented totals.
  const hero = heroLook(outfits);

  return (
    <>
      <Nav />
      <Ticker />

      <HeroShowcase />

      <Stats stats={homeStats(outfits)} />

      <div className="shell">
        <DecodedThisWeek />
      </div>

      {hero ? <SwapDemo heroLook={hero} swapSteps={swapSteps} /> : null}

      <div className="shell">
        <Budget />
        <DupeOfTheWeek />
        <Occasions />
        <Trending />
        <Celebrities />
        <Campaign
          campaign={campaign}
          looks={looksInGroup(occasions, outfits, "Wedding").length}
        />
      </div>

      <BrandMarquee />
      <Trust />

      <div className="shell">
        <Reels />
        <Signup />
      </div>

      <Footer />
      <MobileTabs />
      <ScrollEffects />
    </>
  );
}
