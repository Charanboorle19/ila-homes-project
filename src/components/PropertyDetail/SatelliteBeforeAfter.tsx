"use client";

import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { PropertyRecord } from "@/data/properties";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const SATELLITE_STYLE = {
  version: 8 as const,
  sources: {
    satellite: {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Tiles © Esri",
    },
  },
  layers: [
    {
      id: "satellite",
      type: "raster" as const,
      source: "satellite",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

export default function SatelliteBeforeAfter({
  property,
}: {
  property: PropertyRecord;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [activeYear, setActiveYear] = useState(
    property.timeline[property.timeline.length - 2]?.year ??
      property.timeline[0]?.year ??
      "",
  );
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);

  const active =
    property.timeline.find((item) => item.year === activeYear) ??
    property.timeline[0];

  useEffect(() => {
    setActiveYear(
      property.timeline[property.timeline.length - 2]?.year ??
        property.timeline[0]?.year ??
        "",
    );
  }, [property.id, property.timeline]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const map = new MapLibreMap({
        container: containerRef.current,
        style: SATELLITE_STYLE,
        center: property.coordinates,
        zoom: active?.zoom ?? property.zoom,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      map.on("load", () => {
        markerRef.current = new Marker({ color: "#c6a46c" })
          .setLngLat(property.coordinates)
          .addTo(map);
        setMapReady(true);
      });
      map.on("error", () => setMapError(true));
    } catch {
      setMapError(true);
    }

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // Mount once; property updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !active) return;
    map.easeTo({
      center: property.coordinates,
      zoom: active.zoom,
      duration: 700,
    });
    markerRef.current?.setLngLat(property.coordinates);
  }, [active, mapReady, property.coordinates]);

  return (
    <section className="pd-section pd-sat" aria-labelledby="pd-sat-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Location story</p>
        <h2 id="pd-sat-title">How this place has changed</h2>
        <p className="pd-section__lead">
          Timeline copy is property-specific. Satellite tiles are approximate demo
          context — not surveyed boundaries.
        </p>

        <div className="pd-sat__layout">
          <div className="pd-sat__map-wrap">
            <div ref={containerRef} className="pd-sat__map" />
            <div className="pd-sat__overlay">
              <strong>{property.name}</strong>
              <span>{property.location}</span>
            </div>
            {mapError ? (
              <p className="pd-sat__fallback">
                Satellite map unavailable right now. Timeline story still works
                below.
              </p>
            ) : null}
          </div>

          <div className="pd-sat__story">
            <div className="pd-sat__years" role="tablist" aria-label="Timeline years">
              {property.timeline.map((item) => {
                const selected = item.year === active?.year;
                return (
                  <button
                    key={item.year}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    className={selected ? "is-active" : ""}
                    onClick={() => setActiveYear(item.year)}
                  >
                    {item.year}
                  </button>
                );
              })}
            </div>
            {active ? (
              <div aria-live="polite">
                <h3>{active.title}</h3>
                <p>{active.story}</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
