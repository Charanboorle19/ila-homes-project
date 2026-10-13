"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import shareWhatsappGif from "@/app/assets/share on what'sapp.gif";
import familyCommunityImg from "@/app/assets/Family Dreams Over a New Community.png";
import familyHomecomingImg from "@/app/assets/Golden-Hour Family Homecoming.png";
import realEstateGrowthImg from "@/app/assets/Golden Hour Real Estate Growth.png";
import plannedCityscapeImg from "@/app/assets/Golden-Hour View of Planned Cityscape.png";
import { trackEvent } from "@/services/analytics/tracker";
import { fetchProperties, type PropertyListItem } from "@/services/propertiesService";
import { buildShareUrl, createPropertyShares } from "@/services/shareService";
import { ILA_PROPERTY_ID } from "@/lib/ilaApiConfig";
import ShortlistPreviewModal from "./ShortlistPreviewModal";
import "./ShortlistShare.css";

const PROPERTY_IMAGES: StaticImageData[] = [
  familyCommunityImg,
  familyHomecomingImg,
  realEstateGrowthImg,
  plannedCityscapeImg,
];

export type ShortlistPlot = {
  id: string;
  name: string;
  location: string;
  meta: string;
  highlight: string;
  /**
   * The property's own cover, from `GET /api/properties`.
   *
   * Null when the row publishes no `cover_url`, and non-null-but-403 when the
   * presigned signature has expired — which is why `image` stays alongside it as
   * an underneath fallback rather than being used as the primary source.
   */
  coverUrl: string | null;
  /** Local asset used only when there is no usable `coverUrl`. */
  image: StaticImageData;
};

function toPlot(property: PropertyListItem, index: number): ShortlistPlot {
  const price = property.price
    ? `₹${property.price.toLocaleString("en-IN")}`
    : "Price on request";

  return {
    id: property.id,
    name: property.name,
    // `slug` is a URL segment, not a place — it used to be shown here, which
    // put something like "maheshwaram-enclave-4f2" in the locality line.
    // `locality` and `city` are the same fields `GrowthCorridors` reads, and
    // they are both optional on the list row.
    location: property.locality || property.city || "Hyderabad",
    meta: [property.property_type, property.price_label ?? price]
      .filter(Boolean)
      .join(" · "),
    highlight:
      property.description || "Property details available from ILA Homes.",
    coverUrl: property.cover_url,
    image: PROPERTY_IMAGES[index % PROPERTY_IMAGES.length],
  };
}

const FEATURES = [
  {
    number: "01",
    title: "Save as you browse",
    copy: "Pin plots while exploring — no login needed.",
  },
  {
    number: "02",
    title: "WhatsApp-ready card",
    copy: "One tap builds a clean summary your family can read in seconds.",
  },
  {
    number: "03",
    title: "Shareable link",
    copy: "Each property gets its own trackable link.",
  },
] as const;

function buildShareText(plots: ShortlistPlot[], urls: string[]) {
  const sections = plots.map((plot, index) => {
    const url = urls[index]?.trim() || "";
    return [
      `*${plot.name}*`,
      `📍 ${plot.location} · ${plot.meta}`,
      url,
    ].filter(Boolean).join("\n");
  });

  return [
    "🏡 *My Shortlisted Properties via ILA Homes*",
    "",
    sections.join("\n\n"),
    "",
    "Open the links to review layouts, pricing & financing together.",
  ].join("\n");
}

export default function ShortlistShare() {
  const [properties, setProperties] = useState<ShortlistPlot[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    fetchProperties({
      status: "ALL",
      page: 1,
      perPage: 100,
      signal: controller.signal,
    })
      .then((result) => setProperties(result.items.map(toPlot)))
      .catch((requestError: unknown) => {
        if (
          !(requestError instanceof DOMException && requestError.name === "AbortError")
        ) {
          setError("Properties could not be loaded. Please try again.");
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const selected = useMemo(
    () => properties.filter((plot) => pinned.includes(plot.id)),
    [properties, pinned],
  );

  // Native scrolling with overscroll-behavior-y: auto allows the scroll
  // to smoothly chain to page scroll when reaching the top or bottom boundaries.

  const togglePlot = (id: string) => {
    const wasPinned = pinned.includes(id);
    setPinned((current) =>
      wasPinned ? current.filter((item) => item !== id) : [...current, id],
    );
    setShared(false);

    trackEvent({
      event_type: wasPinned ? "SHORTLIST_REMOVE" : "SHORTLIST_ADD",
      property_id: id || ILA_PROPERTY_ID,
      metadata: { property_id: id, section_type: "shortlist_whatsapp" },
    });
  };

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  // When visitor clicks Share, prepare the tracked links and open the preview popup
  const handleOpenPreview = async () => {
    if (!selected.length || sharing) return;

    setSharing(true);
    setError(null);
    try {
      const shares = await createPropertyShares({
        entityIds: selected.map((plot) => plot.id),
        message: "Please review these properties",
      });
      const origin = window.location.origin;
      const urls = shares.map((share) =>
        buildShareUrl(share.tracking_token!, origin),
      );
      setPreviewUrls(urls);
      setPreviewOpen(true);
    } catch {
      // Fallback: construct links using origins directly if share endpoint fails
      const fallbackUrls = selected.map(
        (plot) => `${window.location.origin}/properties/${plot.id}`,
      );
      setPreviewUrls(fallbackUrls);
      setPreviewOpen(true);
    } finally {
      setSharing(false);
    }
  };

  // Called from the preview popup once confirmed
  const confirmShareOnWhatsApp = () => {
    if (!selected.length) return;

    const text = buildShareText(selected, previewUrls);
    window.open(
      `https://wa.me/?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener,noreferrer",
    );
    setShared(true);
    setPreviewOpen(false);

    trackEvent({
      event_type: "WHATSAPP_SHARE_CLICK",
      property_id: selected[0].id,
      metadata: {
        shortlist_count: selected.length,
        property_ids: selected.map((item) => item.id),
        section_type: "shortlist_whatsapp",
      },
    });
  };

  const renderChoose = (instance: "desktop" | "mobile") => (
    <div className="shortlist-share__choose">
      <p className="shortlist-share__choose-label">Choose plots to share</p>
      <div className="shortlist-share__options">
        {properties.map((plot) => {
          const isSelected = pinned.includes(plot.id);
          return (
            <button
              key={`${instance}-${plot.id}`}
              type="button"
              className={`shortlist-share__option${
                isSelected ? " is-selected" : ""
              }`}
              aria-pressed={isSelected}
              onClick={() => togglePlot(plot.id)}
            >
              <span className="shortlist-share__option-media">
                {/* The local asset is always mounted as the *underneath* layer and
                    the API cover paints over it. Two cases need it: a property
                    with no `cover_url`, and one whose presigned URL has expired
                    and answers 403. `onError` hides only the overlay, so both
                    reveal this rather than a broken-image glyph or a hole.

                    Assigning a local image by list position instead — which is
                    what this did — meant the picture had no relationship to the
                    property it was attached to: property 1 always got the same
                    family photo whatever the API returned. */}
                <span
                  aria-hidden
                  className="shortlist-share__option-fallback"
                >
                  <Image
                    className="shortlist-share__option-image"
                    src={plot.image}
                    alt=""
                    fill
                    sizes="(max-width: 980px) 5.75rem, 7rem"
                  />
                </span>

                {plot.coverUrl ? (
                  <Image
                    className="shortlist-share__option-image shortlist-share__option-cover"
                    src={plot.coverUrl}
                    alt=""
                    fill
                    sizes="(max-width: 980px) 5.75rem, 7rem"
                    // Presigned cover URLs expire, so they are loaded directly
                    // rather than through the optimizer cache — the same reason
                    // `GrowthCorridors` sets `unoptimized` on its card images.
                    unoptimized
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : null}

                <span className="shortlist-share__option-check" aria-hidden="true">
                  {isSelected ? "✓" : ""}
                </span>
              </span>
              <span className="shortlist-share__option-body">
                <span className="shortlist-share__option-copy">
                  <span className="shortlist-share__option-name">{plot.name}</span>
                  <span className="shortlist-share__option-loc">{plot.location}</span>
                </span>
                <span className="shortlist-share__option-meta">{plot.meta}</span>
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="shortlist-share__wa-btn"
        onClick={handleOpenPreview}
        disabled={!selected.length || sharing}
      >
        {sharing
          ? "Preparing preview…"
          : shared
            ? "Shared — open again"
            : !selected.length
              ? "Select properties to share"
              : `Preview & Share (${selected.length}) →`}
      </button>
    </div>
  );

  const introStyle = { "--accent": "#c9a84c" } as CSSProperties;
  const countText = loading
    ? "Loading properties…"
    : error ??
      (pinned.length
        ? `${pinned.length} ${pinned.length === 1 ? "property" : "properties"} selected`
        : properties.length
          ? "Select properties on the right to build your shortlist"
          : "No properties are currently available");

  return (
    <section className="shortlist-share" id="shortlist-share" aria-label="Shortlist and share">
      <div className="shortlist-share__frame">
        <div className="shortlist-share__left">
          <header className="shortlist-share__intro" style={introStyle}>
            <div className="shortlist-share__intro-bg" aria-hidden="true">
              <Image
                className="shortlist-share__intro-bg-image"
                src={shareWhatsappGif}
                alt=""
                fill
                sizes="100vw"
                unoptimized
              />
            </div>
            <div className="shortlist-share__intro-content">
              <h2 className="shortlist-share__heading">
                Save your shortlist. Share it on WhatsApp in one tap.
              </h2>
            </div>
          </header>
          <ol className="shortlist-share__features" aria-label="How shortlist sharing works">
            {FEATURES.map((feature, index) => (
              <li key={feature.number} className="shortlist-share__feature-item">
                <div className="shortlist-share__feature">
                  <span className="shortlist-share__feature-index" aria-hidden="true">
                    {feature.number}
                  </span>
                  <span className="shortlist-share__feature-body">
                    <span className="shortlist-share__feature-title">{feature.title}</span>
                    <span className="shortlist-share__feature-copy">{feature.copy}</span>
                  </span>
                </div>
                {index < FEATURES.length - 1 ? (
                  <span className="shortlist-share__feature-line" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ol>
          <div className="shortlist-share__choose-mobile">{renderChoose("mobile")}</div>
          <p className="shortlist-share__count">
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <span className="ila-loader ila-loader--sm" aria-hidden />
                {countText}
              </span>
            ) : (
              countText
            )}
          </p>
          <button
            type="button"
            className="shortlist-share__share"
            onClick={handleOpenPreview}
            disabled={!selected.length || sharing}
          >
            {sharing ? "Preparing preview…" : "Preview & Share on WhatsApp"} <span aria-hidden="true">→</span>
          </button>
        </div>
        <aside className="shortlist-share__right" aria-live="polite">
          <div className="shortlist-share__detail-inner">
            <div className="shortlist-share__copy">
              <div className="shortlist-share__choose-desktop">{renderChoose("desktop")}</div>
            </div>
            <div className="shortlist-share__media">
              <div className="shortlist-share__media-frame">
                <Image
                  className="shortlist-share__media-image"
                  src={shareWhatsappGif}
                  alt="Sharing properties with family on WhatsApp"
                  fill
                  sizes="(max-width: 980px) 100vw, 28vw"
                  unoptimized
                />
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ShortlistPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        selectedPlots={selected}
        urls={previewUrls}
        onConfirmShare={confirmShareOnWhatsApp}
        sharing={sharing}
      />
    </section>
  );
}