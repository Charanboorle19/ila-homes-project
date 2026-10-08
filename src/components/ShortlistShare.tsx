"use client";

import Image, { type StaticImageData } from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type WheelEvent,
} from "react";
import shareWhatsappGif from "@/app/assets/share on what'sapp.gif";
import { trackEvent } from "@/services/analytics/tracker";
import { ILA_PROPERTY_ID } from "@/lib/ilaApiConfig";
import familyCommunityImg from "@/app/assets/Family Dreams Over a New Community.png";
import familyHomecomingImg from "@/app/assets/Golden-Hour Family Homecoming.png";
import realEstateGrowthImg from "@/app/assets/Golden Hour Real Estate Growth.png";
import plannedCityscapeImg from "@/app/assets/Golden-Hour View of Planned Cityscape.png";
import { propertyLayouts, type LayoutId } from "@/data/propertyLayouts";
import "./ShortlistShare.css";

const APPRECIATION: Partial<Record<LayoutId, number>> = {
  "sark-green-plains": 94,
  "singapore-township": 76,
  "nallagandla-enclave": 82,
  "kokapet-heights": 91,
  "khajaguda-residency": 74,
  "patancheru-gateway": 88,
  "mansanpally-meadows": 79,
};

const PROPERTY_IMAGES: StaticImageData[] = [
  familyCommunityImg,
  familyHomecomingImg,
  realEstateGrowthImg,
  plannedCityscapeImg,
];

type ShortlistPlot = {
  id: LayoutId;
  name: string;
  location: string;
  meta: string;
  highlight: string;
  score: number;
  image: StaticImageData;
};

const PROPERTIES: ShortlistPlot[] = propertyLayouts.map((layout, index) => ({
  id: layout.id,
  name: layout.label,
  location: layout.location,
  meta: `${layout.plotSizes} · ${layout.priceRange} · ${layout.tag}`,
  highlight: layout.highlight,
  score: APPRECIATION[layout.id] ?? 70,
  image: PROPERTY_IMAGES[index % PROPERTY_IMAGES.length],
}));

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
    copy: "Anyone who opens it sees the same shortlist, with full context.",
  },
] as const;

const INITIAL_PINNED: LayoutId[] = [
  "nallagandla-enclave",
  "kokapet-heights",
];

function buildShareText(plots: ShortlistPlot[]) {
  const lines = plots.map(
    (plot) =>
      `• ${plot.name} · ${plot.location}\n  ${plot.meta}\n  Appreciation: ${plot.score}/100`,
  );
  return [
    "My shortlisted plots via ILA Homes",
    "",
    ...lines,
    "",
    "Open the shortlist to review together.",
  ].join("\n");
}

export default function ShortlistShare() {
  const [pinned, setPinned] = useState<LayoutId[]>(INITIAL_PINNED);
  const [shared, setShared] = useState(false);
  const mobilePanelsRef = useRef<HTMLDivElement | null>(null);

  const selected = useMemo(
    () => PROPERTIES.filter((plot) => pinned.includes(plot.id)),
    [pinned],
  );

  useEffect(() => {
    const el = mobilePanelsRef.current;
    if (!el) return;

    let startY = 0;

    const onTouchStart = (event: TouchEvent) => {
      startY = event.touches[0]?.clientY ?? 0;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;

      const currentY = event.touches[0]?.clientY ?? startY;
      const deltaY = currentY - startY;
      const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop >= maxScroll - 1;

      // At list bounds → release nested scroll so the page can continue
      if ((deltaY > 0 && atTop) || (deltaY < 0 && atBottom) || maxScroll <= 0) {
        el.style.overflowY = "hidden";
      } else {
        el.style.overflowY = "auto";
      }
    };

    const restoreOverflow = () => {
      el.style.overflowY = "";
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", restoreOverflow, { passive: true });
    el.addEventListener("touchcancel", restoreOverflow, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", restoreOverflow);
      el.removeEventListener("touchcancel", restoreOverflow);
      el.style.overflowY = "";
    };
  }, []);

  const togglePlot = (id: LayoutId) => {
    const wasPinned = pinned.includes(id);

    setPinned((prev) => {
      if (prev.includes(id)) return prev.filter((item) => item !== id);
      return [...prev, id];
    });
    setShared(false);

    trackEvent({
      event_type: wasPinned ? "SHORTLIST_REMOVE" : "SHORTLIST_ADD",
      // The API requires a property_id on shortlist events; the live map
      // property is the layout these plots belong to.
      property_id: ILA_PROPERTY_ID,
      metadata: {
        layout_id: id,
        property_id: ILA_PROPERTY_ID,
        section_type: "shortlist_whatsapp",
      },
    });
  };

  const shareOnWhatsApp = () => {
    if (selected.length === 0) return;
    const text = buildShareText(selected);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setShared(true);

    trackEvent({
      event_type: "WHATSAPP_SHARE_CLICK",
      property_id: ILA_PROPERTY_ID,
      metadata: {
        shortlist_count: selected.length,
        layout_ids: selected.map((item) => item.id),
        property_id: ILA_PROPERTY_ID,
        section_type: "shortlist_whatsapp",
      },
    });
  };

  const introStyle = {
    "--ss-intro-image": `url("${(shareWhatsappGif as StaticImageData).src}")`,
  } as CSSProperties;

  const handlePanelsWheel = (event: WheelEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const maxScroll = Math.max(0, el.scrollHeight - el.clientHeight);
    const atTop = el.scrollTop <= 0;
    const atBottom = el.scrollTop >= maxScroll - 1;

    if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
      // Pass scroll to the page once the list can't move further
      window.scrollBy({ top: event.deltaY });
    }
  };

  const renderChoose = (instance: "mobile" | "desktop") => (
    <div className="shortlist-share__choose">
      <header className="shortlist-share__detail-head">
        <p className="shortlist-share__detail-kicker">Choose plots</p>
        <h3 className="shortlist-share__detail-title">
          Select properties to shortlist
        </h3>
        <p className="shortlist-share__detail-summary">
          Tap any property to add or remove it from your WhatsApp shortlist.
        </p>
      </header>

      <div
        ref={instance === "mobile" ? mobilePanelsRef : undefined}
        className="shortlist-share__panels"
        role="group"
        aria-label="All properties"
        onWheel={instance === "mobile" ? handlePanelsWheel : undefined}
      >
        {PROPERTIES.map((plot) => {
          const isOn = pinned.includes(plot.id);
          if (instance === "desktop") {
            return (
              <button
                key={`${instance}-${plot.id}`}
                type="button"
                className={`shortlist-share__option${isOn ? " is-selected" : ""}`}
                aria-pressed={isOn}
                onClick={() => togglePlot(plot.id)}
              >
                <span className="shortlist-share__option-top">
                  <span
                    className="shortlist-share__option-check"
                    aria-hidden="true"
                  >
                    {isOn ? "✓" : ""}
                  </span>
                  <span className="shortlist-share__option-copy">
                    <span className="shortlist-share__option-name">
                      {plot.name}
                    </span>
                    <span className="shortlist-share__option-loc">
                      {plot.location}
                    </span>
                  </span>
                </span>
                <span className="shortlist-share__option-meta">{plot.meta}</span>
                <span className="shortlist-share__option-score">
                  Appreciation score: {plot.score}/100
                </span>
              </button>
            );
          }

          return (
            <button
              key={`${instance}-${plot.id}`}
              type="button"
              className={`shortlist-share__option shortlist-share__option--media${isOn ? " is-selected" : ""}`}
              aria-pressed={isOn}
              onClick={() => togglePlot(plot.id)}
            >
              <span className="shortlist-share__option-media">
                <Image
                  src={plot.image}
                  alt=""
                  fill
                  sizes="140px"
                  className="shortlist-share__option-image"
                />
                <span
                  className="shortlist-share__option-check"
                  aria-hidden="true"
                >
                  {isOn ? "✓" : ""}
                </span>
              </span>
              <span className="shortlist-share__option-body">
                <span className="shortlist-share__option-copy">
                  <span className="shortlist-share__option-name">
                    {plot.name}
                  </span>
                  <span className="shortlist-share__option-loc">
                    {plot.location}
                  </span>
                </span>
                <span className="shortlist-share__option-meta">{plot.meta}</span>
                <span className="shortlist-share__option-score">
                  Appreciation score: {plot.score}/100
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        className="shortlist-share__wa-btn"
        onClick={shareOnWhatsApp}
        disabled={pinned.length === 0}
      >
        {shared
          ? "Shared — open again"
          : pinned.length === 0
            ? "Select plots to share"
            : `Share ${pinned.length} ${pinned.length === 1 ? "plot" : "plots"} →`}
      </button>
    </div>
  );

  return (
    <section
      className="shortlist-share"
      id="shortlist-share"
      aria-label="Shortlist and share"
    >
      <div className="shortlist-share__frame">
        <div className="shortlist-share__left">
          <header className="shortlist-share__intro" style={introStyle}>
            <div className="shortlist-share__intro-bg" aria-hidden="true" />
            <div className="shortlist-share__intro-content">
              <h2 className="shortlist-share__heading">
                Save your shortlist. Share it on WhatsApp in one tap.
              </h2>
            </div>
          </header>

          <ol
            className="shortlist-share__features"
            aria-label="How shortlist sharing works"
          >
            {FEATURES.map((feature, index) => (
              <li key={feature.number} className="shortlist-share__feature-item">
                <div className="shortlist-share__feature">
                  <span
                    className="shortlist-share__feature-index"
                    aria-hidden="true"
                  >
                    {feature.number}
                  </span>
                  <span className="shortlist-share__feature-body">
                    <span className="shortlist-share__feature-title">
                      {feature.title}
                    </span>
                    <span className="shortlist-share__feature-copy">
                      {feature.copy}
                    </span>
                  </span>
                </div>
                {index < FEATURES.length - 1 ? (
                  <span
                    className="shortlist-share__feature-line"
                    aria-hidden="true"
                  />
                ) : null}
              </li>
            ))}
          </ol>

          <div className="shortlist-share__choose-mobile">
            {renderChoose("mobile")}
          </div>

          <p className="shortlist-share__count">
            {pinned.length === 0
              ? "Select plots on the right to build your shortlist"
              : `${pinned.length} ${pinned.length === 1 ? "plot" : "plots"} selected`}
          </p>

          <button
            type="button"
            className="shortlist-share__share"
            onClick={shareOnWhatsApp}
            disabled={pinned.length === 0}
          >
            Share on WhatsApp
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <aside className="shortlist-share__right" aria-live="polite">
          <div className="shortlist-share__detail-inner">
            <div className="shortlist-share__copy">
              <div className="shortlist-share__choose-desktop">
                {renderChoose("desktop")}
              </div>
            </div>

            <div className="shortlist-share__media">
              <div className="shortlist-share__media-frame">
                <Image
                  className="shortlist-share__media-image"
                  src={shareWhatsappGif}
                  alt="Sharing dream plots with family on WhatsApp"
                  fill
                  sizes="(max-width: 980px) 0px, 28vw"
                  unoptimized
                  priority={false}
                />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
