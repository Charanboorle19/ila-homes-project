"use client";

import Image from "next/image";
import Link from "next/link";
import { forwardRef } from "react";
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

    return (
      <section ref={ref} className="pd-hero" aria-label={`${property.name} overview`}>
        <div className="pd-hero__frame">
          <nav className="pd-hero__crumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span aria-hidden="true">/</span>
            <Link href="/properties">Properties</Link>
            <span aria-hidden="true">/</span>
            <span>{property.location}</span>
          </nav>

          <div className="pd-hero__grid">
            <div className="pd-hero__copy">
              <div className="pd-hero__badges">
                <span className="pd-hero__badge">
                  {property.approval} Approved
                </span>
                {property.reraRegistered ? (
                  <span className="pd-hero__badge pd-hero__badge--ink">
                    RERA Registered
                  </span>
                ) : null}
                <span className="pd-hero__badge pd-hero__badge--plain">
                  {property.possession}
                </span>
              </div>

              <h1 className="pd-hero__title">{property.name}</h1>
              <p className="pd-hero__tagline">{property.tagline}</p>
              <p className="pd-hero__desc">{property.description}</p>

              <dl className="pd-hero__specs">
                {specs.map((spec) => (
                  <div key={spec.label}>
                    <dt>{spec.label}</dt>
                    <dd>{spec.value}</dd>
                  </div>
                ))}
              </dl>

              <div className="pd-hero__price-row">
                <div className="pd-hero__price-block">
                  <p className="pd-hero__price">{priceLabel}</p>
                  <p className="pd-hero__meta">
                    Location score {connectivityScore}/100 ·{" "}
                    {property.viewingCount} viewings · {property.enquiryCount}{" "}
                    enquiries
                  </p>
                </div>
                <div className="pd-hero__actions">
                  <a
                    className="pd-btn pd-btn--primary"
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                  >
                    WhatsApp enquiry
                  </a>
                  <a className="pd-btn pd-btn--ghost" href={siteVisitHref}>
                    Schedule site visit
                  </a>
                </div>
              </div>

              {/*
                The share panel sits below the price row, not inside the CTA
                row. At the wide breakpoint .pd-hero__price-row is a row, so a
                full-width sibling here competes with .pd-hero__price-block for
                space and squeezes the price into a four-line wrap.
              */}
              {isPropertyUuid(property.id) ? (
                <ShareButton
                  propertyId={property.id}
                  propertyName={property.name}
                  message={`Please check this property: ${property.name}${
                    property.location ? `, ${property.location}` : ""
                  }.`}
                />
              ) : null}
            </div>

            <div className="pd-hero__gallery">
              <div className="pd-hero__stage">
                {activeImage ? (
                  <Image
                    src={activeImage.src}
                    alt={activeImage.alt}
                    fill
                    priority
                    sizes="(max-width: 900px) 100vw, 42vw"
                    className="pd-hero__stage-img"
                  />
                ) : null}
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
          </div>
        </div>
      </section>
    );
  },
);

export default PropertyHero;
