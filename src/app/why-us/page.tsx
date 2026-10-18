"use client";

import WhoWeAre from "@/components/WhoWeAre";
import FromTheField from "@/components/FromTheField";
import GrowthCorridors from "@/components/GrowthCorridors";
import BuyingJourney from "@/components/BuyingJourney";
import Faq from "@/components/Faq";
import HomeReadyToVisit from "@/components/HomeReadyToVisit";

export default function WhyUsPage() {
  return (
    <div className="relative min-h-screen w-full bg-[#0a0a0a] text-white">
      {/* 1. Who We Are */}
      <WhoWeAre />

      {/* 2. From The Field (Reels / on-ground validation) */}
      <FromTheField />

      {/* 3. Growth Corridors (Market & corridor intelligence map/cards) */}
      <GrowthCorridors />

      {/* 4. Your Buying Journey (Step-by-step transparent process) */}
      <BuyingJourney />

      {/* 5. FAQs */}
      <Faq />

      {/* 6. Ready to Visit Site Form / Next Steps */}
      <HomeReadyToVisit />
    </div>
  );
}
