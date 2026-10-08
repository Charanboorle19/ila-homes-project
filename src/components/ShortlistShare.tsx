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
import "./ShortlistShare.css";

const PROPERTY_IMAGES: StaticImageData[] = [
  familyCommunityImg,
  familyHomecomingImg,
  realEstateGrowthImg,
  plannedCityscapeImg,
];

type ShortlistPlot = {
  id: string;
  name: string;
  location: string;
  meta: string;
  highlight: string;
  image: StaticImageData;
};

function toPlot(property: PropertyListItem, index: number): ShortlistPlot {
  const price = property.price
    ? `₹${property.price.toLocaleString("en-IN")}`
    : "Price on request";

  return {
    id: property.id,
    name: property.name,
    location: property.slug || "Property details available",
    meta: [property.property_type, property.price_label ?? price]
      .filter(Boolean)
      .join(" · "),
    highlight:
      property.description || "Property details available from ILA Homes.",
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
  return [
    "My shortlisted properties via ILA Homes",
    "",
    ...plots.map(
      (plot, index) =>
        `• ${plot.name} · ${plot.location}\n  ${plot.meta}\n  ${urls[index]}`,
    ),
    "",
    "Open the links to review together.",
  ].join("\n");
}

export default function ShortlistShare() {
  const [properties, setProperties] = useState<ShortlistPlot[]>([]);
  const [pinned, setPinned] = useState<string[]>([]);
  const [shared, setShared] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mobilePanelsRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    const element = mobilePanelsRef.current;
    if (!element) return;

    let startY = 0;
    const onTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const currentY = event.touches[0]?.clientY ?? startY;
      const deltaY = currentY - startY;
      const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight);
      const atTop = element.scrollTop <= 0;
      const atBottom = element.scrollTop >= maxScroll - 1;
      element.style.overflowY =
        (deltaY > 0 && atTop) || (deltaY < 0 && atBottom) || maxScroll <= 0
          ? "hidden"
          : "auto";
    };
    const restoreOverflow = () => {
      element.style.overflowY = "";
    };

    element.addEventListener("touchstart", onTouchStart, { passive: true });
    element.addEventListener("touchmove", onTouchMove, { passive: true });
    element.addEventListener("touchend", restoreOverflow, { passive: true });
    element.addEventListener("touchcancel", restoreOverflow, { passive: true });

    return () => {
      element.removeEventListener("touchstart", onTouchStart);
      element.removeEventListener("touchmove", onTouchMove);
      element.removeEventListener("touchend", restoreOverflow);
      element.removeEventListener("touchcancel", restoreOverflow);
      element.style.overflowY = "";
    };
  }, []);

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

  const shareOnWhatsApp = async () => {
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
      const text = buildShareText(selected, urls);
      window.open(
        `https://wa.me/?text=${encodeURIComponent(text)}`,
        "_blank",
        "noopener,noreferrer",
      );
      setShared(true);
      trackEvent({
        event_type: "WHATSAPP_SHARE_CLICK",
        property_id: selected[0].id,
        metadata: {
          shortlist_count: selected.length,
          property_ids: selected.map((item) => item.id),
          section_type: "shortlist_whatsapp",
        },
      });
    } catch {
      setError("Sharing failed. Please try again.");
    } finally {
      setSharing(false);
    }
  };

  const renderChoose = (instance: "desktop" | "mobile") => (
    <div className="shortlist-share__choose">
      <p className="shortlist-share__choose-label">Choose plots to share</p>
      <div
        className="shortlist-share__options"
        ref={instance === "mobile" ? mobilePanelsRef : undefined}
      >
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
                <Image
                  className="shortlist-share__option-image"
                  src={plot.image}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 5.75rem, 7rem"
                />
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
        onClick={shareOnWhatsApp}
        disabled={!selected.length || sharing}
      >
        {sharing
          ? "Preparing links…"
          : shared
            ? "Shared — open again"
            : !selected.length
              ? "Select properties to share"
              : `Share ${selected.length} ${selected.length === 1 ? "property" : "properties"} →`}
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
          <p className="shortlist-share__count">{countText}</p>
          <button
            type="button"
            className="shortlist-share__share"
            onClick={shareOnWhatsApp}
            disabled={!selected.length || sharing}
          >
            Share on WhatsApp <span aria-hidden="true">→</span>
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
    </section>
  );
}