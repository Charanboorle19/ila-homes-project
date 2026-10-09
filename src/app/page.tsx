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
      <Hero />
      {/* Property and unit data is shown here only, from the API. */}
      <MapSection />
      <WhoWeAre />
      <GrowthCorridors />
      <FindYourPlot />
      <CompareProperties />
      <BuyingJourney />
      <ShortlistShare />
      <EmiAppreciation />
      <FromTheField />
      <PlotsWithPulse />
      <Faq />
    </>
  );
}