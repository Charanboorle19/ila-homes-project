"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PropertyRecord } from "@/data/properties";
import { getPropertyGallery } from "@/data/properties";
import { getSimilarProperties } from "@/lib/similar";
import {
  computeConnectivityScore,
  formatInr,
  siteVisitMailto,
  whatsappUrl,
} from "@/lib/propertyUtils";
import PropertyHero from "@/components/PropertyDetail/PropertyHero";
import LifeStageMatch from "@/components/PropertyDetail/LifeStageMatch";
import FutureNeighbourhoodMap from "@/components/PropertyDetail/FutureNeighbourhoodMap";
import Lifestyle from "@/components/PropertyDetail/Lifestyle";
import PriceEmiFuture from "@/components/PropertyDetail/PriceEmiFuture";
import LegalDocuments from "@/components/PropertyDetail/LegalDocuments";
import SatelliteBeforeAfter from "@/components/PropertyDetail/SatelliteBeforeAfter";
import BuyingJourneySteps from "@/components/PropertyDetail/BuyingJourneySteps";
import SimilarProperties from "@/components/PropertyDetail/SimilarProperties";
import PropertyFinalCta from "@/components/PropertyDetail/PropertyFinalCta";
import StickyBottomCta from "@/components/PropertyDetail/StickyBottomCta";
import { useTrackPropertyView } from "@/services/analytics/usePropertyView";
import "./PropertyDetail.css";

type PropertyPageViewProps = {
  property: PropertyRecord;
  documentsState?: "loading" | "ready" | "error";
};

export default function PropertyPageView({
  property,
  documentsState = "ready",
}: PropertyPageViewProps) {
  const heroRef = useRef<HTMLElement | null>(null);

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

  const activeImage =
    gallery.find((item) => item.id === activeGalleryId) ?? gallery[0];

  const waText = `Hi ILA Homes, I'm interested in ${property.name} (${property.location}). Please share availability and a site-visit slot.`;

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
        siteVisitHref={siteVisitMailto(property)}
        priceLabel={property.priceLabel ?? formatInr(property.price)}
      />

      <LifeStageMatch property={property} />
      <FutureNeighbourhoodMap property={property} />
      <Lifestyle key={property.id} property={property} />
      <PriceEmiFuture property={property} />
      <LegalDocuments property={property} documentsState={documentsState} />
      <SatelliteBeforeAfter property={property} />
      <BuyingJourneySteps />
      <SimilarProperties items={similar} />
      <PropertyFinalCta property={property} />
      <StickyBottomCta
        property={property}
        heroRef={heroRef}
        siteVisitHref={siteVisitMailto(property)}
      />
    </div>
  );
}
