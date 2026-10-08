"use client";

import { useEffect, useState, type RefObject } from "react";
import type { PropertyRecord } from "@/data/properties";
import { whatsappUrl } from "@/lib/propertyUtils";

type StickyBottomCtaProps = {
  property: PropertyRecord;
  heroRef: RefObject<HTMLElement | null>;
  siteVisitHref: string;
};

export default function StickyBottomCta({
  property,
  heroRef,
  siteVisitHref,
}: StickyBottomCtaProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [property.id]);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0.12 },
    );

    observer.observe(hero);
    return () => observer.disconnect();
  }, [heroRef, property.id]);

  if (dismissed || !visible) return null;

  const waText = `Hi ILA Homes, please help me schedule a site visit for ${property.name} (${property.location}).`;

  return (
    <div className="pd-sticky" role="region" aria-label="Site visit shortcut">
      <div className="pd-sticky__inner">
        <div>
          <p className="pd-sticky__label">Still exploring {property.name}?</p>
          <p className="pd-sticky__meta">Book a guided site visit</p>
        </div>
        <div className="pd-sticky__actions">
          <a
            className="pd-btn pd-btn--primary"
            href={siteVisitHref}
            data-track="ENQUIRY_CLICK"
            data-track-property={property.id}
            data-track-meta='{"button_location":"sticky_bottom_cta","channel":"email"}'
          >
            Email visit
          </a>
          <a
            className="pd-btn pd-btn--ghost"
            href={whatsappUrl(waText)}
            target="_blank"
            rel="noreferrer"
            data-track="WHATSAPP_CHAT_CLICK"
            data-track-property={property.id}
            data-track-meta='{"button_location":"sticky_bottom_cta"}'
          >
            WhatsApp
          </a>
          <button
            type="button"
            className="pd-sticky__close"
            aria-label="Dismiss sticky bar"
            onClick={() => setDismissed(true)}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
