"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PropertyRecord } from "@/data/properties";
import { getPropertyGallery } from "@/data/properties";
import { getSimilarProperties } from "@/lib/similar";
import {
  computeConnectivityScore,
  formatInr,
  whatsappUrl,
} from "@/lib/propertyUtils";
import PropertyHero from "@/components/PropertyDetail/PropertyHero";
import MapSection from "@/components/MapSection";
import LifeStageMatch from "@/components/PropertyDetail/LifeStageMatch";
import FutureNeighbourhoodMap from "@/components/PropertyDetail/FutureNeighbourhoodMap";
import Lifestyle from "@/components/PropertyDetail/Lifestyle";
import AffordabilityFinancing from "@/components/PropertyDetail/AffordabilityFinancing";
import LegalDocuments from "@/components/PropertyDetail/LegalDocuments";
import PriceHistoryGraph from "@/components/PropertyDetail/PriceHistoryGraph";
import BuyingJourneySteps from "@/components/PropertyDetail/BuyingJourneySteps";
import SimilarProperties from "@/components/PropertyDetail/SimilarProperties";
import PropertyFinalCta from "@/components/PropertyDetail/PropertyFinalCta";
import StickyBottomCta from "@/components/PropertyDetail/StickyBottomCta";
import { useTrackPropertyView } from "@/services/analytics/usePropertyView";
import "./PropertyDetail.css";

type PropertyPageViewProps = {
  property: PropertyRecord;
  documentsState?: "loading" | "ready" | "error";
  imagesLoading?: boolean;
};

export default function PropertyPageView({
  property,
  documentsState = "ready",
  imagesLoading = false,
}: PropertyPageViewProps) {
  const heroRef = useRef<HTMLElement | null>(null);
  const lifestyleRef = useRef<HTMLDivElement | null>(null);
  /** The enquiry form, so the sticky bar can step aside while it is on screen. */
  const formRef = useRef<HTMLElement | null>(null);

  const scrollToNextStep = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const target =
      formRef.current ??
      document.getElementById("next-step") ??
      document.querySelector(".pd-final");
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
      const nameInput = target.querySelector<HTMLInputElement>("input[name='name']");
      nameInput?.focus({ preventScroll: true });
    }
  };

  // PROPERTY_VIEW on entry, TIME_ON_PROPERTY + PROPERTY_REVISIT on exit.
  useTrackPropertyView(property.id);
  const gallery = useMemo(() => getPropertyGallery(property), [property]);
  const similar = useMemo(() => getSimilarProperties(property), [property]);
  const connectivityScore = useMemo(
    () => computeConnectivityScore(property),
    [property],
  );
  const [activeGalleryId, setActiveGalleryId] = useState(gallery[0]?.id ?? "");

  useEffect(() => {
    setActiveGalleryId(gallery[0]?.id ?? "");
  }, [property.id, gallery]);

  useEffect(() => {
    const scrollToAffordability = () => {
      const hash = window.location.hash;
      if (
        hash === "#affordability-financing" ||
        hash === "#loan-calculator" ||
        hash === "#pd-affordability"
      ) {
        const el =
          document.getElementById("affordability-financing") ||
          document.getElementById("pd-affordability");
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
    };

    const timer = setTimeout(scrollToAffordability, 120);
    window.addEventListener("hashchange", scrollToAffordability);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("hashchange", scrollToAffordability);
    };
  }, []);

  const activeImage =
    gallery.find((item) => item.id === activeGalleryId) ?? gallery[0];

  const waText =
    "Hi, I'm interested in learning more about this property. Could you please share the details?";

  return (
    <div className="property-page">
      <PropertyHero
        ref={heroRef}
        property={property}
        gallery={gallery}
        activeImage={activeImage}
        onSelectGallery={setActiveGalleryId}
        connectivityScore={connectivityScore}
        whatsappHref={whatsappUrl(waText)}
        siteVisitHref="#next-step"
        onScheduleVisit={scrollToNextStep}
        priceLabel={property.priceLabel ?? formatInr(property.price)}
        imagesLoading={imagesLoading}
      />

      <MapSection
        propertyId={property.id}
        hideDetails
        hideSearch
        highlightAvailable
      />

      <LifeStageMatch property={property} />
      <FutureNeighbourhoodMap property={property} />
      <div ref={lifestyleRef} className="scroll-mt-24">
        <Lifestyle key={property.id} property={property} />
      </div>
      <div id="affordability-financing" className="scroll-mt-24">
        <AffordabilityFinancing property={property} />
      </div>
      <LegalDocuments
        property={property}
        documentsState={documentsState}
      />
      <PriceHistoryGraph property={property} />
      <BuyingJourneySteps />
      <SimilarProperties items={similar} />
      <PropertyFinalCta property={property} formRef={formRef} />
      <StickyBottomCta
        property={property}
        heroRef={heroRef}
        lifestyleRef={lifestyleRef}
        formRef={formRef}
        siteVisitHref="#next-step"
        onScheduleVisit={scrollToNextStep}
      />
    </div>
  );
}
