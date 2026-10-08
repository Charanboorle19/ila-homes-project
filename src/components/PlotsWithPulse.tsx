"use client";

import Image, { type StaticImageData } from "next/image";
import { useEffect, useState } from "react";
import plotBgKokapet from "@/app/assets/plots-pulse/kokapet.jpg";
import plotBgNallagandla from "@/app/assets/plots-pulse/nallagandla.jpg";
import plotBgMansanpally from "@/app/assets/plots-pulse/mansanpally.jpg";
import plotBgSarkGreen from "@/app/assets/about-panel/hero-property.jpg";
import { fetchProperties, formatPrice, type PropertyListItem } from "@/services/propertiesService";
import "./PlotsWithPulse.css";

const FALLBACK_IMAGES: StaticImageData[] = [plotBgSarkGreen, plotBgKokapet, plotBgNallagandla, plotBgMansanpally];

type PulsePlot = {
  id: string; name: string; location: string; meta: string; price: string; status: string;
  image: StaticImageData | string; viewing: number; enquiries: number; lastVisitedMin: number;
  appreciation: number; connectivity: number; infra: number;
};

function formatArea(property: PropertyListItem) {
  const range = property.area_range;
  if (!range || (range.min == null && range.max == null)) return "";
  if (range.min != null && range.max != null && range.min !== range.max) return `${range.min}–${range.max} sq yards`;
  return `${range.min ?? range.max} sq yards`;
}

function toPlot(property: PropertyListItem, index: number): PulsePlot {
  const location = property.slug || "Location details available";
  const meta = [formatArea(property), property.property_type, property.price_label].filter(Boolean).join(" · ");
  const inventory = property.available_plots_count;
  return {
    id: property.id,
    name: property.name,
    location,
    meta: meta || "Property details available",
    price: property.price_label || formatPrice(property.price),
    status: "Available",
    image: property.cover_url || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length],
    // Activity values remain provisional presentation values; catalogue data is API-backed.
    viewing: Math.min(12, Math.max(1, (inventory ?? 1) % 8 + 1)),
    enquiries: Math.max(1, (property.total_plots ?? 1) % 4),
    lastVisitedMin: 8 + (index % 4) * 4,
    appreciation: 78 + (index % 5),
    connectivity: 72 + (index % 7),
    infra: 76 + (index % 6),
  };
}

function nudgeViewing(current: number) {
  return Math.min(12, Math.max(1, current + (Math.random() < 0.55 ? 1 : -1)));
}

function BarRow({ label, value }: { label: string; value: number }) {
  return <div className="plots-pulse__bar-row"><span className="plots-pulse__bar-label">{label}</span><div className="plots-pulse__bar-track"><div className="plots-pulse__bar-fill" style={{ width: `${value}%` }} /></div><span className="plots-pulse__bar-val">{value}%</span></div>;
}

export default function PlotsWithPulse() {
  const [plots, setPlots] = useState<PulsePlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchProperties({ status: "ALL", page: 1, perPage: 100, signal: controller.signal })
      .then((result) => setPlots(result.items.map(toPlot)))
      .catch((requestError: unknown) => {
        if (!(requestError instanceof DOMException && requestError.name === "AbortError")) setError("Properties could not be loaded. Please try again later.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!plots.length) return;
    const intervalId = window.setInterval(() => setPlots((previous) => previous.map((plot) => ({
      ...plot,
      viewing: nudgeViewing(plot.viewing),
      lastVisitedMin: Math.min(59, plot.lastVisitedMin + (Math.random() < 0.4 ? 1 : 0)),
    }))), 4500);
    return () => window.clearInterval(intervalId);
  }, [plots.length]);

  return (
    <section data-section="compare_plots" className="plots-pulse" aria-labelledby="plots-pulse-heading">
      <div className="plots-pulse__frame">
        <header className="plots-pulse__intro">
          <p className="plots-pulse__eyebrow">Plots with pulse</p>
          <h2 id="plots-pulse-heading" className="plots-pulse__heading">See what others<br />are looking at right now.</h2>
          <p className="plots-pulse__lede">Live activity on each plot — who&apos;s interested, when it was last visited, how it&apos;s appreciated.</p>
          <p className="plots-pulse__updating" role="status"><strong>Updating this section.</strong> These activity numbers are provisional demo estimates — not accurate live data.</p>
        </header>
        {loading ? <p role="status">Loading properties…</p> : null}
        {!loading && error ? <p role="alert">{error}</p> : null}
        {!loading && !error && !plots.length ? <p role="status">No properties are currently available.</p> : null}
        <div className="plots-pulse__grid">
          {plots.map((plot, index) => (
            <article key={plot.id} className="plots-pulse__card">
              <div className="plots-pulse__image">
                <Image className="plots-pulse__image-bg" src={plot.image} alt="" fill sizes="(max-width: 900px) 70vw, 25vw" priority={index === 0} draggable={false} />
                <span className="plots-pulse__image-text">{plot.name} · {plot.location.split("·")[0]?.trim() || plot.location.split(",")[0]}</span>
                <span className="plots-pulse__badge">{plot.status}</span>
                <div className="plots-pulse__live"><span className="plots-pulse__ping" />{plot.viewing} viewing now</div>
              </div>
              <div className="plots-pulse__body">
                <h3 className="plots-pulse__name">{plot.name}</h3>
                <p className="plots-pulse__meta">{plot.meta}</p>
                <p className="plots-pulse__price">{plot.price}</p>
                <ul className="plots-pulse__signals"><li><span className="plots-pulse__ping plots-pulse__ping--sm" />{plot.viewing} people viewing now</li><li>{plot.enquiries} enquiries today</li><li>Last visited {plot.lastVisitedMin} min ago</li></ul>
                <div className="plots-pulse__bars"><BarRow label="Appreciation" value={plot.appreciation} /><BarRow label="Connectivity" value={plot.connectivity} /><BarRow label="Infra Growth" value={plot.infra} /></div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}