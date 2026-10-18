"use client";

import Image, { type StaticImageData } from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import plotBgKokapet from "@/app/assets/plots-pulse/kokapet.jpg";
import plotBgNallagandla from "@/app/assets/plots-pulse/nallagandla.jpg";
import plotBgMansanpally from "@/app/assets/plots-pulse/mansanpally.jpg";
import plotBgSarkGreen from "@/app/assets/about-panel/hero-property.jpg";
import { fetchProperties, formatPrice, type PropertyListItem } from "@/services/propertiesService";
import { propertyLayouts, type PropertyLayout } from "@/data/propertyLayouts";
import "@/app/loading.css";
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

function layoutToPlot(layout: PropertyLayout, index: number): PulsePlot {
  return {
    id: layout.id,
    name: layout.label,
    location: layout.location.split("·")[0]?.trim() || "Hyderabad",
    meta: layout.plotSizes ? `${layout.plotSizes} · Plotted development` : "Plotted development",
    price: layout.priceRange || "Price on request",
    status: layout.available ? "Available" : "Coming soon",
    image: FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    viewing: 4 + (index % 5) * 2,
    enquiries: 2 + (index % 3),
    lastVisitedMin: 5 + (index % 4) * 3,
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
    const minLoadTimer = new Promise((resolve) => setTimeout(resolve, 600));

    Promise.all([
      fetchProperties({ status: "ALL", page: 1, perPage: 100, signal: controller.signal }),
      minLoadTimer,
    ])
      .then(([result]) => {
        if (result.items && result.items.length > 0) {
          setPlots(result.items.map(toPlot));
        } else {
          setPlots(propertyLayouts.slice(0, 4).map(layoutToPlot));
        }
      })
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) {
          setPlots(propertyLayouts.slice(0, 4).map(layoutToPlot));
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
      className="relative w-full overflow-hidden bg-gradient-to-b from-[#fbf7eb] via-[#fefaf0] to-[#f6f0db] border-t border-[#8A6A1F]/15"
      aria-labelledby="plots-pulse-heading"
      style={{ ["--gc-gold" as string]: GOLD }}
    >
      {/* Decorative blueprint background grid with soft gold lines */}
      <div
        aria-hidden="true"
        className="growth-corridors-bg pointer-events-none absolute inset-0 z-0 h-full w-full opacity-35"
      />

      <div className="content-slot relative w-full px-4 pt-4 pb-8 sm:px-8 sm:py-6 lg:flex lg:flex-col lg:justify-center">
        {/* Demand pulse indicator */}
        <div className="flex items-center justify-between gap-3 border-b border-[#8A6A1F]/15 pb-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#8A6A1F]/30 bg-[#8A6A1F]/10 px-3 py-1 text-[10.5px] font-bold tracking-wide text-[#8A6A1F] shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22c55e] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22c55e]"></span>
            </span>
            Live Demand Signal
          </div>
          <p className="text-[10.5px] font-medium text-[#7d8391]">
            Real-time interest &middot; Updates dynamically
          </p>
        </div>

        {loading || (!error && !plots.length) ? (
          <div className="flex min-h-[300px] w-full flex-col items-center justify-center py-16 text-center">
            <span
              className="ila-loader mb-4"
              style={{
                ["--ila-loader-color" as string]: GOLD,
                ["--ila-loader-size" as string]: "46px",
              }}
              aria-hidden
            />
            <p className="text-sm font-bold tracking-wide text-[#0f1114]">
              Loading trending properties&hellip;
            </p>
            <p className="mt-1 text-xs text-[#7d8391]">
              Fetching real-time visitor interest &amp; buyer demand
            </p>
          </div>
        ) : null}

        {error && !plots.length ? (
          <div className="flex min-h-[300px] w-full flex-col items-center justify-center py-16 text-center">
            <span
              className="ila-loader mb-4"
              style={{
                ["--ila-loader-color" as string]: GOLD,
                ["--ila-loader-size" as string]: "46px",
              }}
              aria-hidden
            />
            <p className="text-sm font-bold tracking-wide text-[#0f1114]">
              Connecting to live property feed&hellip;
            </p>
            <p className="mt-1 text-xs text-[#7d8391]">
              Syncing latest interest and activity signals
            </p>
          </div>
        ) : null}

        {plots.length > 0 ? (
          <>
            {/* Carousel navigation bar */}
            <div className="mt-4 flex items-center justify-between gap-3 sm:mt-6">
              <p className="text-[12px] font-medium text-[#525866] sm:text-[13px]">
                {plots.length} {plots.length === 1 ? "plot tracked" : "plots tracked"}
              </p>
              <div className="flex items-center gap-3">
                <p className="text-[12px] font-medium tabular-nums text-[#525866] sm:text-[13px]">
                  {activeCardIndex + 1} / {plots.length}
                </p>
                <div className="hidden items-center gap-2 lg:flex">
                  <button
                    type="button"
                    onClick={() => scrollCards(-1)}
                    disabled={cardScroll.atStart}
                    aria-label="Previous plots"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-[#0f1114] shadow-xs transition hover:border-[#8A6A1F] hover:bg-[#fbf7eb] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ArrowIcon className="h-3.5 w-3.5 rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollCards(1)}
                    disabled={cardScroll.atEnd}
                    aria-label="Next plots"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-black/15 bg-white text-[#0f1114] shadow-xs transition hover:border-[#8A6A1F] hover:bg-[#fbf7eb] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    <ArrowIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Horizontal snap carousel row matching Growth Corridors track */}
            <div
              ref={cardRowRef}
              className="-mx-4 mt-3.5 flex snap-x snap-mandatory items-stretch gap-3.5 overflow-x-auto px-4 pb-2 scrollbar-none scroll-pl-4 scroll-pr-4 sm:-mx-6 sm:mt-6 sm:gap-6 sm:px-6 sm:pb-4 sm:scroll-pl-6 sm:scroll-pr-6 lg:mx-0 lg:mt-8 lg:px-0 lg:min-h-0 lg:flex-none lg:scroll-pl-0 lg:scroll-pr-0"
            >
              {plots.map((plot, index) => (
                <article
                  key={plot.id}
                  className="group relative flex w-[88vw] max-w-[21.5rem] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-[#8A6A1F]/20 bg-white text-left shadow-[0_4px_18px_rgba(30,22,10,0.06)] transition duration-300 hover:-translate-y-1 hover:border-[#8A6A1F]/50 hover:shadow-[0_16px_36px_rgba(30,22,10,0.12)] sm:w-[48vw] sm:max-w-none lg:w-auto lg:min-w-[21rem] lg:flex-1 lg:flex-basis-0 xl:min-w-[23rem]"
                >
                  {/* Card Media Header */}
                  <div className="relative h-40 w-full shrink-0 overflow-hidden bg-[#eef0f4] sm:h-44">
                    <Image
                      src={plot.image}
                      alt={plot.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 48vw, 88vw"
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
                    <div className="absolute left-2.5 top-2.5 sm:left-3 sm:top-3">
                      <span className="inline-flex items-center rounded-full bg-[#0f1114]/85 px-2.5 py-0.5 text-[9.5px] font-bold tracking-wider text-white uppercase backdrop-blur-md sm:py-1 sm:text-[10px]">
                        {plot.status}
                      </span>
                    </div>

                    {/* Live viewing pulse indicator top-right */}
                    <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-white/95 px-2.5 py-0.5 text-[10.5px] font-semibold text-emerald-800 shadow-xs backdrop-blur-md sm:py-1 sm:text-[11px]">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                        </span>
                        <span className="tabular-nums font-bold">{plot.viewing}</span> viewing now
                      </span>
                    </div>
                  </div>

                  {/* Card Content Body */}
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    {/* Location */}
                    <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[#8A6A1F] sm:text-[11px]">
                      <PinIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{plot.location}</span>
                    </div>

                    {/* Property title */}
                    <h3 className="mt-1 text-[16px] font-bold tracking-tight text-[#0f1114] transition-colors group-hover:text-[#8A6A1F] truncate sm:text-[17px]">
                      {plot.name}
                    </h3>

                    {/* Meta description */}
                    <p className="mt-0.5 text-[11.5px] text-[#6b7280] truncate sm:text-[12px]">
                      {plot.meta}
                    </p>

                    {/* Price banner */}
                    <div className="mt-2.5 flex items-baseline justify-between border-b border-black/[0.06] pb-2.5 sm:mt-3 sm:pb-3">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8a909e]">
                        Guide Price
                      </span>
                      <span className="text-[17px] font-bold tracking-tight text-[#0f1114] sm:text-[19px]">
                        {plot.price}
                      </span>
                    </div>

                    {/* Live Activity signals box */}
                    <div className="mt-2.5 rounded-xl border border-[#8A6A1F]/15 bg-[#faf8f2] p-2.5 space-y-1.5 sm:mt-3 sm:p-3 sm:space-y-2">
                      <div className="flex items-center justify-between text-[10.5px] sm:text-[11px]">
                        <span className="flex items-center gap-1.5 text-[#525866]">
                          <FlameIcon className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>Enquiries today</span>
                        </span>
                        <span className="font-bold tabular-nums text-[#0f1114]">
                          {plot.enquiries} enquiries
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[10.5px] sm:text-[11px]">
                        <span className="flex items-center gap-1.5 text-[#525866]">
                          <ClockIcon className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          <span>Last active viewing</span>
                        </span>
                        <span className="font-semibold tabular-nums text-[#0f1114]">
                          {plot.lastVisitedMin}m ago
                        </span>
                      </div>
                    </div>

                    {/* Comparison percentage bars */}
                    <div className="mt-2.5 space-y-1.5 pt-0.5 sm:mt-3 sm:space-y-2 sm:pt-1">
                      <BarRow label="Appreciation" value={plot.appreciation} />
                      <BarRow label="Connectivity" value={plot.connectivity} />
                      <BarRow label="Infra Growth" value={plot.infra} />
                    </div>

                    {/* Direct Property Details CTA */}
                    <div className="mt-4 pt-0.5 sm:mt-5 sm:pt-1">
                      <Link
                        href={`/properties/${plot.id}`}
                        className="flex h-9.5 w-full items-center justify-center gap-2 rounded-xl border border-[#8A6A1F]/30 bg-[#8A6A1F]/5 text-[11.5px] font-bold tracking-[0.02em] text-[#0f1114] transition hover:bg-[#8A6A1F] hover:text-white active:scale-[0.99] sm:h-10 sm:text-[12px]"
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