"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PropertyRecord } from "@/data/properties";
import { whatsappUrl } from "@/lib/propertyUtils";

/** Gap left between the bar and the content it would otherwise cover. */
const CLEARANCE_GAP_PX = 12;

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
  const barRef = useRef<HTMLDivElement>(null);

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

  /**
   * Publishes the bar's measured height for the page to reserve.
   *
   * The bar is fixed, so it is taken out of flow and overlays whatever sits at
   * the bottom of the page. The final CTA section is the last content on the
   * page, which is exactly where the enquiry form's buttons are, so without a
   * matching bottom padding the bar paints over them and swallows their clicks.
   *
   * The height is measured rather than hard-coded because it genuinely varies:
   * the actions row wraps onto a second line on narrow screens, and the
   * safe-area inset adds height on notched devices. A constant would silently
   * stop clearing the bar at exactly the widths where it wraps.
   *
   * Removing the property on cleanup is what makes dismissal work: once the bar
   * is gone the variable falls back to 0 and the reserved space collapses.
   */
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      document.documentElement.style.removeProperty("--pd-sticky-clearance");
      return undefined;
    }

    const publish = () => {
      const height = bar.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--pd-sticky-clearance",
        `${Math.ceil(height + CLEARANCE_GAP_PX)}px`,
      );
    };

    publish();

    const observer = new ResizeObserver(publish);
    observer.observe(bar);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty("--pd-sticky-clearance");
    };
  }, [dismissed, visible]);

  if (dismissed || !visible) return null;

  const waText = `Hi ILA Homes, please help me schedule a site visit for ${property.name} (${property.location}).`;

  return (
    <div
      className="pd-sticky"
      ref={barRef}
      role="region"
      aria-label="Site visit shortcut"
    >
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
