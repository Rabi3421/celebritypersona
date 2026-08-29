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
import { getHomeContent } from "@/lib/db/content";

export default async function Home() {
  const { stats, heroLook, swapSteps } = await getHomeContent();

  return (
    <>
      <Nav />
      <Ticker />

      <HeroShowcase />

      <Stats stats={stats} />

      <div className="shell">
        <DecodedThisWeek />
      </div>

      <SwapDemo heroLook={heroLook} swapSteps={swapSteps} />

      <div className="shell">
        <Budget />
        <DupeOfTheWeek />
        <Occasions />
        <Trending />
        <Celebrities />
        <Campaign />
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
