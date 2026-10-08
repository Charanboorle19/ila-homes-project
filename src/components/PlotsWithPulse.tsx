"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import { propertyLayouts, type LayoutId } from "@/data/propertyLayouts";
import plotBgKokapet from "@/app/assets/plots-pulse/kokapet.jpg";
import plotBgNallagandla from "@/app/assets/plots-pulse/nallagandla.jpg";
import plotBgMansanpally from "@/app/assets/plots-pulse/mansanpally.jpg";
import plotBgSarkGreen from "@/app/assets/about-panel/hero-property.jpg";
import "./PlotsWithPulse.css";

const FEATURED_IDS = [
  "sark-green-plains",
  "kokapet-heights",
  "nallagandla-enclave",
  "mansanpally-meadows",
] as const satisfies readonly LayoutId[];

const PLOT_IMAGES: Record<(typeof FEATURED_IDS)[number], StaticImageData> = {
  "sark-green-plains": plotBgSarkGreen,
  "kokapet-heights": plotBgKokapet,
  "nallagandla-enclave": plotBgNallagandla,
  "mansanpally-meadows": plotBgMansanpally,
};

type PulseSeed = {
  badge: string;
  viewing: number;
  enquiries: number;
  lastVisitedMin: number;
  appreciation: number;
  connectivity: number;
  infra: number;
  available: boolean;
};

const PULSE_SEED: Record<(typeof FEATURED_IDS)[number], PulseSeed> = {
  "sark-green-plains": {
    badge: "Open",
    viewing: 5,
    enquiries: 2,
    lastVisitedMin: 11,
    appreciation: 84,
    connectivity: 76,
    infra: 81,
    available: true,
  },
  "kokapet-heights": {
    badge: "Hot",
    viewing: 6,
    enquiries: 2,
    lastVisitedMin: 14,
    appreciation: 91,
    connectivity: 88,
    infra: 86,
    available: false,
  },
  "nallagandla-enclave": {
    badge: "New",
    viewing: 2,
    enquiries: 1,
    lastVisitedMin: 8,
    appreciation: 82,
    connectivity: 79,
    infra: 74,
    available: false,
  },
  "mansanpally-meadows": {
    badge: "Best Value",
    viewing: 4,
    enquiries: 3,
    lastVisitedMin: 21,
    appreciation: 79,
    connectivity: 71,
    infra: 84,
    available: false,
  },
};

type PulsePlot = {
  id: LayoutId;
  name: string;
  location: string;
  meta: string;
  price: string;
  status: string;
  image: StaticImageData;
} & PulseSeed;

function formatPrice(priceRange: string | undefined) {
  if (!priceRange) return "";
  return priceRange.split(/[–·]/)[0]?.trim() ?? priceRange;
}

function buildPlots(): PulsePlot[] {
  return FEATURED_IDS.map((id) => {
    const layout = propertyLayouts.find((item) => item.id === id);
    const pulse = PULSE_SEED[id];
    const available = pulse.available !== false;
    return {
      id,
      name: available ? (layout?.label ?? id) : "Coming soon",
      location: available ? (layout?.location ?? "") : "",
      meta: available
        ? `${layout?.plotSizes ?? ""} · ${layout?.tag ?? ""}`
        : "Details coming soon",
      price: available ? formatPrice(layout?.priceRange) : "Adding soon",
      status: available ? (layout?.status ?? "") : "Updating Soon",
      image: PLOT_IMAGES[id],
      available,
      badge: pulse.badge,
      viewing: pulse.viewing,
      enquiries: pulse.enquiries,
      lastVisitedMin: pulse.lastVisitedMin,
      appreciation: pulse.appreciation,
      connectivity: pulse.connectivity,
      infra: pulse.infra,
    };
  });
}

function nudgeViewing(current: number) {
  const delta = Math.random() < 0.55 ? 1 : -1;
  return Math.min(12, Math.max(1, current + delta));
}

function BarRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="plots-pulse__bar-row">
      <span className="plots-pulse__bar-label">{label}</span>
      <div className="plots-pulse__bar-track">
        <div
          className="plots-pulse__bar-fill"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="plots-pulse__bar-val">{value}%</span>
    </div>
  );
}

export default function PlotsWithPulse() {
  const [plots, setPlots] = useState<PulsePlot[]>(buildPlots);

  useEffect(() => {
    const id = window.setInterval(() => {
      setPlots((prev) =>
        prev.map((plot) => {
          if (!plot.available) return plot;
          return {
            ...plot,
            viewing: nudgeViewing(plot.viewing),
            lastVisitedMin: Math.min(
              59,
              plot.lastVisitedMin + (Math.random() < 0.4 ? 1 : 0),
            ),
          };
        }),
      );
    }, 4500);

    return () => window.clearInterval(id);
  }, []);

  return (
    <section data-section="compare_plots" className="plots-pulse" aria-labelledby="plots-pulse-heading">
      <div className="plots-pulse__frame">
        <header className="plots-pulse__intro">
          <p className="plots-pulse__eyebrow">Plots with pulse</p>
          <h2 id="plots-pulse-heading" className="plots-pulse__heading">
            See what others
            <br />
            are looking at right now.
          </h2>
          <p className="plots-pulse__lede">
            Live activity on each plot — who&apos;s interested, when it was last
            visited, how it&apos;s appreciated.
          </p>
          <p className="plots-pulse__updating" role="status">
            <strong>Updating this section.</strong> These activity numbers are
            provisional demo estimates — not accurate live data.
          </p>
        </header>

        <div className="plots-pulse__grid">
          {plots.map((plot) => (
            <article
              key={plot.id}
              className={`plots-pulse__card${plot.available ? "" : " is-soon"}`}
              aria-disabled={!plot.available}
            >
              <div className="plots-pulse__image">
                <Image
                  className="plots-pulse__image-bg"
                  src={plot.image}
                  alt=""
                  fill
                  sizes="(max-width: 900px) 70vw, 25vw"
                  priority={plot.id === "sark-green-plains"}
                  draggable={false}
                />
                <span className="plots-pulse__image-text">
                  {plot.available
                    ? `${plot.name} · ${plot.location.split("·")[0]?.trim() || plot.location.split(",")[0]}`
                    : "Coming soon"}
                </span>
                <span className="plots-pulse__badge">
                  {plot.available ? plot.badge : "Soon"}
                </span>
                {plot.available ? (
                  <div className="plots-pulse__live">
                    <span className="plots-pulse__ping" />
                    {plot.viewing} viewing now
                  </div>
                ) : (
                  <div className="plots-pulse__live plots-pulse__live--soon">
                    Adding soon
                  </div>
                )}
              </div>

              <div className="plots-pulse__body">
                <h3 className="plots-pulse__name">{plot.name}</h3>
                <p className="plots-pulse__meta">{plot.meta}</p>
                <p className="plots-pulse__price">{plot.price}</p>

                {plot.available ? (
                  <>
                    <ul className="plots-pulse__signals">
                      <li>
                        <span className="plots-pulse__ping plots-pulse__ping--sm" />
                        {plot.viewing} people viewing now
                      </li>
                      <li>{plot.enquiries} enquiries today</li>
                      <li>Last visited {plot.lastVisitedMin} min ago</li>
                    </ul>

                    <div className="plots-pulse__bars">
                      <BarRow label="Appreciation" value={plot.appreciation} />
                      <BarRow label="Connectivity" value={plot.connectivity} />
                      <BarRow label="Infra Growth" value={plot.infra} />
                    </div>
                  </>
                ) : (
                  <p className="plots-pulse__soon-copy">
                    Layout pulse data is being updated. Check back soon.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
