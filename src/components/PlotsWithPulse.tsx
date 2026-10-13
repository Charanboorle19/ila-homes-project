"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import plotBgKokapet from "@/app/assets/plots-pulse/kokapet.jpg";
import plotBgNallagandla from "@/app/assets/plots-pulse/nallagandla.jpg";
import plotBgMansanpally from "@/app/assets/plots-pulse/mansanpally.jpg";
import plotBgSarkGreen from "@/app/assets/about-panel/hero-property.jpg";
import { fetchProperties, formatPrice, type PropertyListItem } from "@/services/propertiesService";
import "./PlotsWithPulse.css";

const FALLBACK_IMAGES: StaticImageData[] = [
  plotBgSarkGreen,
  plotBgKokapet,
  plotBgNallagandla,
  plotBgMansanpally,
];

const GOLD = "#8A6A1F";

type PulsePlot = {
  id: string;
  name: string;
  location: string;
  meta: string;
  price: string;
  status: string;
  image: StaticImageData | string;
  viewing: number;
  enquiries: number;
  lastVisitedMin: number;
  appreciation: number;
  connectivity: number;
  infra: number;
};

function formatArea(property: PropertyListItem) {
  const range = property.area_range;
  if (!range || (range.min == null && range.max == null)) return "";
  if (range.min != null && range.max != null && range.min !== range.max) {
    return `${range.min}–${range.max} sq yards`;
  }
  return `${range.min ?? range.max} sq yards`;
}

function toPlot(property: PropertyListItem, index: number): PulsePlot {
  const location = (property.locality || property.city || property.slug || "Hyderabad")
    .split("·")[0]
    ?.trim();
  const meta = [formatArea(property), property.property_type].filter(Boolean).join(" · ");
  const inventory = property.available_plots_count;

  return {
    id: property.id,
    name: property.name,
    location: location || "Hyderabad",
    meta: meta || "Plotted development",
    price: property.price_label || formatPrice(property.price),
    status: property.status === "COMING_SOON" ? "Coming soon" : "Available",
    image: property.cover_url || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    viewing: Math.min(12, Math.max(1, ((inventory ?? 1) % 8) + 2)),
    enquiries: Math.max(1, ((property.total_plots ?? 3) % 4) + 1),
    lastVisitedMin: 4 + (index % 5) * 3,
    appreciation: 78 + (index % 5) * 3,
    connectivity: 82 + (index % 4) * 3,
    infra: 76 + (index % 6) * 3,
  };
}

function nudgeViewing(current: number) {
  return Math.min(12, Math.max(1, current + (Math.random() < 0.55 ? 1 : -1)));
}

function ArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function FlameIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2c-.5 2.5-3 4.5-3 8 0 3.31 2.69 6 6 6 1.8 0 3.4-.8 4.46-2.07C19.8 17.65 16.2 21 12 21c-4.42 0-8-3.58-8-8 0-4.04 3.01-7.4 6.9-7.91L12 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ClockIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BarRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="w-24 shrink-0 font-medium text-[#6b7280]">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
        <div
          className="h-full rounded-full bg-[#8A6A1F] transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-bold tabular-nums text-[#8A6A1F]">
        {value}%
      </span>
    </div>
  );
}

export default function PlotsWithPulse() {
  const [plots, setPlots] = useState<PulsePlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardRowRef = useRef<HTMLDivElement | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cardScroll, setCardScroll] = useState({ atStart: true, atEnd: false });

  const scrollCards = (direction: 1 | -1) => {
    const row = cardRowRef.current;
    if (!row) return;
    const first = row.firstElementChild as HTMLElement | null;
    if (!first) return;
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    row.scrollBy({
      left: direction * (first.offsetWidth + gap),
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchProperties({ status: "ALL", page: 1, perPage: 100, signal: controller.signal })
      .then((result) => setPlots(result.items.map(toPlot)))
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setError("Properties could not be loaded. Please try again later.");
        }
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!plots.length) return;
    const intervalId = window.setInterval(() => {
      setPlots((previous) =>
        previous.map((plot) => ({
          ...plot,
          viewing: nudgeViewing(plot.viewing),
          lastVisitedMin: Math.min(59, plot.lastVisitedMin + (Math.random() < 0.4 ? 1 : 0)),
        }))
      );
    }, 4500);
    return () => window.clearInterval(intervalId);
  }, [plots.length]);

  useEffect(() => {
    const row = cardRowRef.current;
    if (!row) return;

    const syncToScroll = () => {
      const first = row.firstElementChild as HTMLElement | null;
      if (!first || plots.length === 0) return;

      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const advance = first.offsetWidth + gap;
      if (advance <= 0) return;

      const index = Math.round(row.scrollLeft / advance);
      setActiveCardIndex(Math.min(Math.max(index, 0), plots.length - 1));

      const maxScroll = row.scrollWidth - row.clientWidth;
      setCardScroll((previous) => {
        const atStart = row.scrollLeft <= 1;
        const atEnd = row.scrollLeft >= maxScroll - 1;
        return previous.atStart === atStart && previous.atEnd === atEnd
          ? previous
          : { atStart, atEnd };
      });
    };

    syncToScroll();

    row.addEventListener("scroll", syncToScroll, { passive: true });
    window.addEventListener("resize", syncToScroll);
    return () => {
      row.removeEventListener("scroll", syncToScroll);
      window.removeEventListener("resize", syncToScroll);
    };
  }, [plots]);

  return (
    <section
      data-section="compare_plots"
      id="plots-pulse"
      className="relative w-full overflow-hidden bg-[#eceef2]"
      aria-labelledby="plots-pulse-heading"
      style={{ ["--gc-gold" as string]: GOLD }}
    >
      {/* Decorative blueprint background grid identical to Growth Corridors */}
      <div
        aria-hidden="true"
        className="growth-corridors-bg pointer-events-none absolute inset-0 z-0 h-full w-full"
      />

      <div className="content-slot relative w-full px-6 py-16 sm:px-10 sm:py-24 lg:flex lg:flex-col lg:justify-center lg:pt-10 lg:pb-6 xl:pt-12">
        {/* Two-column header layout matching Growth Corridors rhythm */}
        <header className="lg:flex lg:items-end lg:justify-between lg:gap-12 lg:shrink-0">
          <div className="max-w-xl">
            <p className="text-[10px] font-bold tracking-[0.22em] text-[#8A6A1F] uppercase">
              Plots with pulse
            </p>
            <h2
              id="plots-pulse-heading"
              className="mt-3 text-[24px] font-semibold tracking-[-0.01em] text-balance text-[#0f1114] lg:text-[32px]"
            >
              See what others are looking at right now
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-[#4a5060]">
              Live activity on each plot — who&apos;s interested, when it was last visited, and how it&apos;s appreciated.
            </p>
          </div>

          <div className="mt-6 flex flex-col items-start gap-2 sm:items-end lg:mt-0 lg:shrink-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#8A6A1F]/30 bg-[#8A6A1F]/10 px-3.5 py-1.5 text-[11px] font-semibold tracking-wide text-[#8A6A1F]">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
              </span>
              Live Demand Signal
            </div>
            <p className="text-[11px] text-[#8a909e]">
              Provisional demo estimates &middot; Updates dynamically
            </p>
          </div>
        </header>

        {loading ? (
          <p className="mt-8 inline-flex items-center gap-2 text-sm text-[#4a5060]">
            <span className="ila-loader ila-loader--sm" aria-hidden />
            Loading properties&hellip;
          </p>
        ) : null}

        {!loading && error ? (
          <p className="mt-8 text-sm text-[#4a5060]" role="alert">
            {error}
          </p>
        ) : null}

        {!loading && !error && !plots.length ? (
          <p className="mt-8 text-sm text-[#4a5060]" role="status">
            No properties are currently available.
          </p>
        ) : null}

        {plots.length > 0 ? (
          <>
            {/* Carousel navigation bar matching Growth Corridors */}
            <div className="mt-6 flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-[#4a5060]">
                {plots.length} {plots.length === 1 ? "plot tracked" : "plots tracked"}
              </p>
              <div className="flex items-center gap-3">
                <p className="text-[13px] font-medium tabular-nums text-[#4a5060]">
                  {activeCardIndex + 1} / {plots.length}
                </p>
                <div className="hidden items-center gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={() => scrollCards(-1)}
                    disabled={cardScroll.atStart}
                    aria-label="Previous plots"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-[#0f1114] transition hover:border-[#8A6A1F] hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ArrowIcon className="h-3.5 w-3.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCards(1)}
                    disabled={cardScroll.atEnd}
                    aria-label="Next plots"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-[#0f1114] transition hover:border-[#8A6A1F] hover:bg-white/60 disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ArrowIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Horizontal snap carousel row matching Growth Corridors track */}
            <div
              ref={cardRowRef}
              className="-mx-6 mt-6 flex snap-x snap-mandatory items-stretch gap-6 overflow-x-auto px-6 pb-4 scrollbar-none scroll-pl-6 scroll-pr-6 sm:mx-0 sm:px-0 sm:scroll-pl-0 sm:scroll-pr-0 lg:mt-8 lg:min-h-0 lg:flex-none"
            >
              {plots.map((plot, index) => (
                <article
                  key={plot.id}
                  className="group relative flex w-[82vw] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white text-left shadow-[0_4px_20px_rgba(15,17,20,0.04)] transition duration-300 hover:-translate-y-1 hover:border-[#8A6A1F]/50 hover:shadow-[0_16px_36px_rgba(15,17,20,0.08)] sm:w-[48vw] lg:w-auto lg:min-w-[21rem] lg:flex-1 lg:flex-basis-0 xl:min-w-[23rem]"
                >
                  {/* Card Media Header (Inset landscape image with live viewing badge, not full-bleed card) */}
                  <div className="relative h-44 w-full shrink-0 overflow-hidden bg-[#eef0f4]">
                    <Image
                      src={plot.image}
                      alt={plot.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, 80vw"
                      unoptimized={typeof plot.image === "string"}
                      priority={index === 0}
                      className="object-cover transition duration-700 ease-out group-hover:scale-105"
                      onError={(event) => {
                        const target = event.currentTarget as HTMLImageElement;
                        target.style.display = "none";
                      }}
                    />
                    <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />

                    {/* Status badge top-left */}
                    <div className="absolute left-3 top-3">
                      <span className="inline-flex items-center rounded-full bg-[#0f1114]/80 px-2.5 py-1 text-[10px] font-bold tracking-wider text-white uppercase backdrop-blur-md">
                        {plot.status}
                      </span>
                    </div>

                    {/* Live viewing pulse indicator top-right */}
                    <div className="absolute right-3 top-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-xs backdrop-blur-md">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                        </span>
                        <span className="tabular-nums font-bold">{plot.viewing}</span> viewing now
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="flex flex-1 flex-col p-5">
                    {/* Location */}
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8A6A1F]">
                      <PinIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{plot.location}</span>
                    </div>

                    {/* Property title */}
                    <h3 className="mt-1 text-[17px] font-bold tracking-tight text-[#0f1114] transition-colors group-hover:text-[#8A6A1F] truncate">
                      {plot.name}
                    </h3>

                    {/* Meta description */}
                    <p className="mt-0.5 text-[12px] text-[#6b7280] truncate">
                      {plot.meta}
                    </p>

                    {/* Price banner */}
                    <div className="mt-3 flex items-baseline justify-between border-b border-black/[0.06] pb-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8a909e]">
                        Guide Price
                      </span>
                      <span className="text-[19px] font-bold tracking-tight text-[#0f1114]">
                        {plot.price}
                      </span>
                    </div>

                    {/* Live Activity signals box */}
                    <div className="mt-3 rounded-xl border border-black/[0.04] bg-[#f8f9fb] p-3 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-[#4a5060]">
                          <FlameIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>Enquiries today</span>
                        </span>
                        <span className="font-bold tabular-nums text-[#0f1114]">
                          {plot.enquiries} enquiries
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1.5 text-[#4a5060]">
                          <ClockIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>Last active viewing</span>
                        </span>
                        <span className="font-semibold tabular-nums text-[#0f1114]">
                          {plot.lastVisitedMin}m ago
                        </span>
                      </div>
                    </div>

                    {/* Comparison percentage bars */}
                    <div className="mt-3 space-y-2 pt-1">
                      <BarRow label="Appreciation" value={plot.appreciation} />
                      <BarRow label="Connectivity" value={plot.connectivity} />
                      <BarRow label="Infra Growth" value={plot.infra} />
                    </div>

                    {/* Direct Property Details CTA */}
                    <div className="mt-5 pt-1">
                      <Link
                        href={`/properties/${plot.id}`}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#8A6A1F]/30 bg-[#8A6A1F]/5 text-[12px] font-bold tracking-[0.02em] text-[#0f1114] transition hover:bg-[#8A6A1F] hover:text-white active:scale-[0.99]"
                      >
                        <span>View property details</span>
                        <ArrowIcon className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}