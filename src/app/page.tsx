import Hero from "@/components/Hero";
import MapSection from "@/components/MapSection";
import WhoWeAre from "@/components/WhoWeAre";
import GrowthCorridors from "@/components/GrowthCorridors";
import FindYourPlot from "@/components/FindYourPlot";
import CompareProperties from "@/components/CompareProperties";
import BuyingJourney from "@/components/BuyingJourney";
import ShortlistShare from "@/components/ShortlistShare";
import EmiAppreciation from "@/components/EmiAppreciation";
import FromTheField from "@/components/FromTheField";
import PlotsWithPulse from "@/components/PlotsWithPulse";
import Faq from "@/components/Faq";
import HomeReadyToVisit from "@/components/HomeReadyToVisit";

/**
 * Homepage order.
 *
 * The section sequence follows the placement each component's spec document
 * records: Find your plot precedes the buying journey, and shortlist → EMI →
 * field updates → plots with pulse follow it. FindYourPlot also carries
 * id="contact", which is what the map's and property page's enquiry links
 * anchor to, so it must stay on the page. CompareProperties sits directly
 * below FindYourPlot so a visitor who has just picked plots can compare them
 * without leaving the flow.
 */
export default function Home() {
  return (
    <>
      {/* 1. Hero */}
      <Hero />
      {/* 2. Map Section */}
      <MapSection />
      {/* 3. Growth Corridors (plots by area) */}
      <GrowthCorridors />
      {/* 4. Find Your Plot */}
      <FindYourPlot />
      {/* 5. Plots with Pulse */}
      <PlotsWithPulse />
      {/* 6. Who We Are */}
      <WhoWeAre />
      {/* 7. From The Field */}
      <FromTheField />
      {/* 8. EMI & Appreciation Calculator */}
      <EmiAppreciation />
      {/* 9. Compare Properties */}
      <CompareProperties />
      {/* 10. Shortlist & Share */}
      <ShortlistShare />
      {/* 11. Buying Journey */}
      <BuyingJourney />
      {/* 12. FAQ */}
      <Faq />
      {/* 13. Home Ready To Visit */}
      <HomeReadyToVisit />
    </>
  );
}