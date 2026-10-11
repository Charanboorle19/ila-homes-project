"use client";

import Image from "next/image";
import Link from "next/link";
import { forwardRef, useEffect, useState } from "react";
import type { GalleryItem, PropertyRecord } from "@/data/properties";
import { isPropertyUuid } from "@/services/propertiesService";
import ShareButton from "@/components/PropertyDetail/ShareButton";

type PropertyHeroProps = {
  property: PropertyRecord;
  gallery: GalleryItem[];
  activeImage: GalleryItem | undefined;
  onSelectGallery: (id: string) => void;
  connectivityScore: number;
  whatsappHref: string;
  siteVisitHref: string;
  priceLabel: string;
};

const PropertyHero = forwardRef<HTMLElement, PropertyHeroProps>(
  function PropertyHero(
    {
      property,
      gallery,
      activeImage,
      onSelectGallery,
      connectivityScore,
      whatsappHref,
      siteVisitHref,
      priceLabel,
    },
    ref,
  ) {
    const activeIndex = gallery.findIndex(
      (item) => item.id === activeImage?.id,
    );
    const [imageErrorId, setImageErrorId] = useState<string | null>(null);
    const [descriptionExpanded, setDescriptionExpanded] = useState(false);

    useEffect(() => {
      setDescriptionExpanded(false);
    }, [property.id]);

    // API properties publish structured facts (plot-size range, project area,
    // plot count) rather than the static catalogue's facing/dimensions, so the
    // spec row is built from whichever set the record carries.
    const specs =
      property.specs && property.specs.length > 0
        ? property.specs
        : [
            { label: "Size", value: property.sqYards },
            { label: "Facing", value: property.facing },
            { label: "Dimensions", value: property.dimensions },
            { label: "Road", value: property.roadWidth },
          ];
    const specOrder = [
      "Plot size",
      "Plot size (sq ft)",
      "Project area",
      "Plots",
      "Configuration",
    ];
    const orderedSpecs = [...specs].sort((a, b) => {
      const aIndex = specOrder.indexOf(a.label);
      const bIndex = specOrder.indexOf(b.label);
      return (aIndex < 0 ? specOrder.length : aIndex) -
        (bIndex < 0 ? specOrder.length : bIndex);
    });

    return (
      <section ref={ref} className="pd-hero" aria-label={`${property.name} overview`}>
        <div className="pd-hero__frame">
          <Link className="pd-hero__back" href="/properties">
            ‹ Properties
          </Link>
          <nav className="pd-hero__crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/properties">Properties</Link>
            <span aria-hidden="true">/</span>
            <span>{property.location}</span>
          </nav>

          <div className="pd-hero__grid">
            <div className="pd-hero__gallery">
              <div className="pd-hero__stage">
                {activeImage && imageErrorId !== activeImage.id ? (
                  <Image
                    src={activeImage.src}
                    alt={activeImage.alt}
                    fill
                    priority
                    sizes="(max-width: 900px) 100vw, 42vw"
                    className="pd-hero__stage-img"
                    onError={() => setImageErrorId(activeImage.id)}
                  />
                ) : (
                  <div className="pd-hero__image-fallback" role="img" aria-label="Property image unavailable">
                    <span aria-hidden="true">▧</span>
                    <small>Image unavailable</small>
                  </div>
                )}
                {activeIndex >= 0 ? (
                  <p className="pd-hero__count">
                    {activeIndex + 1} / {gallery.length}
                  </p>
                ) : null}
              </div>
              <div className="pd-hero__thumbs" role="list">
                {gallery.map((item) => {
                  const selected = item.id === activeImage?.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="listitem"
                      className={`pd-hero__thumb${selected ? " is-active" : ""}`}
                      aria-pressed={selected}
                      aria-label={`Show ${item.alt}`}
                      onClick={() => onSelectGallery(item.id)}
                    >
                      <Image
                        src={item.src}
                        alt=""
                        fill
                        sizes="96px"
                        className="pd-hero__thumb-img"
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pd-hero__copy">
              <div className="pd-hero__badges pd-hero__badges--ordered">
                <span className="pd-hero__badge pd-hero__badge--trust">
                  <span aria-hidden="true">✓</span>
                  {property.approval} Approved
                </span>
                {property.reraRegistered ? (
                  <span className="pd-hero__badge pd-hero__badge--trust">
                    <span aria-hidden="true">✓</span>
                    RERA Registered
                  </span>
                ) : null}
                <span className="pd-hero__badge pd-hero__badge--status">
                  {property.possession}
                </span>
              </div>

              <div className="pd-hero__identity">
                <h1 className="pd-hero__title">{property.name}</h1>
              </div>

              <div className="pd-hero__price-row pd-hero__price-row--ordered">
                <div className="pd-hero__price-block">
                  <span className="pd-hero__price-label">Price range</span>
                  <p className="pd-hero__price">{priceLabel}</p>
                  <div className="pd-hero__meta">
                    <span className="pd-hero__score-chip">
                      Location score {connectivityScore}/100
                    </span>
                    {property.viewingCount >= 5 ? (
                      <span>{property.viewingCount} viewings</span>
                    ) : null}
                    {property.enquiryCount >= 5 ? (
                      <span>{property.enquiryCount} enquiries</span>
                    ) : null}
                  </div>
                </div>
                <div className="pd-hero__actions">
                  <a
                    className="pd-btn pd-btn--primary pd-hero__whatsapp"
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                      <path d="M19.05 4.93A9.82 9.82 0 0 0 12.04 2a9.94 9.94 0 0 0-8.6 14.92L2 22l5.25-1.38A9.94 9.94 0 0 0 22 12.04a9.83 9.83 0 0 0-2.95-7.11Zm-7.01 15.16a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.12.82.83-3.04-.2-.31a8.1 8.1 0 1 1 6.92 3.84Zm4.45-6.08c-.24-.12-1.42-.7-1.64-.78-.22-.08-.38-.12-.54.12-.16.24-.62.78-.76.94-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.67-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.47-.4-.41-.54-.42h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.56 4.07 3.59.57.25 1.01.4 1.35.51.57.18 1.09.16 1.5.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28Z" />
                    </svg>
                    WhatsApp enquiry
                  </a>
                  <div className="pd-hero__secondary-actions">
                    <a
                      className="pd-btn pd-btn--ghost pd-hero__schedule"
                      href={siteVisitHref}
                    >
                      Schedule site visit
                    </a>
                    {isPropertyUuid(property.id) ? (
                      <ShareButton
                        propertyId={property.id}
                        propertyName={property.name}
                        message={`Please check this property: ${property.name}${
                          property.location ? `, ${property.location}` : ""
                        }.`}
                        className="pd-share--hero"
                      />
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="pd-hero__tagline pd-hero__tagline--ordered">
                {property.tagline}
              </p>

              <dl className="pd-hero__specs pd-hero__specs--ordered">
                {orderedSpecs.map((spec) => (
                  <div
                    key={spec.label}
                    className={spec.label === "Configuration" ? "pd-hero__spec--configuration" : undefined}
                  >
                    <dt>{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="pd-hero__description pd-hero__desc--ordered">
                <p className={descriptionExpanded ? "is-expanded" : ""}>
                  {property.description}
                </p>
                <button
                  type="button"
                  className="pd-hero__read-more"
                  aria-expanded={descriptionExpanded}
                  onClick={() => setDescriptionExpanded((expanded) => !expanded)}
                >
                  {descriptionExpanded ? "Read less" : "Read more"}
                </button>
              </div>

              {/*
                The share panel sits below the price row, not inside the CTA
                row. At the wide breakpoint .pd-hero__price-row is a row, so a
                full-width sibling here competes with .pd-hero__price-block for
                space and squeezes the price into a four-line wrap.
              */}
            </div>

          </div>
        </div>
      </section>
    );
  },
);

export default PropertyHero;
