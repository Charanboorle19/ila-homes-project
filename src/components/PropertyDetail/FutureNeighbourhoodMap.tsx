"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  GeoJSONSource,
  LngLatBounds,
  Map as MapLibreMap,
  Map as MapLibre,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection, LineString, Point } from "geojson";
import type { NeighbourhoodItem, PropertyRecord } from "@/data/properties";
import { distanceFromGachibowliKm } from "@/lib/propertyUtils";

type Horizon = "today" | "2029";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ITEMS_SOURCE = "future-items";
const LINKS_SOURCE = "future-links";
const ORIGIN_SOURCE = "future-origin-src";

const EARTH_RADIUS_KM = 6371;

/**
 * The catalogue stores distances, not coordinates, so marker positions are
 * derived from the plot's own centre. Bearings are spread evenly around the
 * plot to keep labels from stacking, and distances are capped so a 12 km
 * airport run does not push everything else off screen.
 */
function offsetFrom(
  origin: [number, number],
  distanceKm: number,
  bearingDeg: number,
): [number, number] {
  const angular = Math.min(distanceKm, 5.5) / EARTH_RADIUS_KM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin[1] * Math.PI) / 180;
  const lon1 = (origin[0] * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

function buildGeoJson(
  items: NeighbourhoodItem[],
  origin: [number, number],
  horizon: Horizon,
) {
  const step = 360 / Math.max(items.length, 1);

  const points: Feature<Point>[] = items.map((item, index) => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: offsetFrom(origin, item.distanceKm, step * index + 24),
    },
    properties: {
      name: item.name,
      meta: `${item.kind} · ${item.distanceKm.toFixed(1)} km · ${item.status}`,
      status: item.status,
      horizon,
    },
  }));

  const links: Feature<LineString>[] = items.map((item, index) => ({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: [
        origin,
        offsetFrom(origin, item.distanceKm, step * index + 24),
      ],
    },
    properties: { horizon },
  }));

  return {
    points: {
      type: "FeatureCollection",
      features: points,
    } as FeatureCollection<Point>,
    links: {
      type: "FeatureCollection",
      features: links,
    } as FeatureCollection<LineString>,
  };
}

export default function FutureNeighbourhoodMap({
  property,
}: {
  property: PropertyRecord;
}) {
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [nearBy, setNearBy] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);

  const items =
    horizon === "today"
      ? property.neighbourhood.existing
      : property.neighbourhood.proposed;

  const origin: [number, number] = property.coordinates;

  const geo = useMemo(
    () => buildGeoJson(items, origin, horizon),
    [items, origin, horizon],
  );

  const fromGachibowli = useMemo(
    () => distanceFromGachibowliKm(property),
    [property],
  );

  // Create the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Absolute worker URL, matching the developments map on the homepage.
    setWorkerUrl(
      new URL("/maplibre/maplibre-gl-worker.mjs", window.location.origin)
        .toString(),
    );

    let map: MapLibreMap;
    try {
      map = new MapLibre({
        container: containerRef.current,
        style: MAP_STYLE,
        center: origin,
        zoom: property.zoom,
        pitch: 0,
        attributionControl: { compact: true },
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch (error) {
      console.error("Unable to initialise the neighbourhood map", error);
      // Deferred: reporting this needs a render, not a synchronous update
      // inside the effect body.
      queueMicrotask(() => setMapFailed(true));
      return;
    }

    mapRef.current = map;

    map.on("error", (event) => {
      console.error("Neighbourhood map error", event.error);
      if (!readyRef.current) setMapFailed(true);
    });

    map.on("load", () => {
      readyRef.current = true;

      map.addSource(ORIGIN_SOURCE, {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: { type: "Point", coordinates: origin },
              properties: { label: property.neighbourhood.mapLabel },
            },
          ],
        },
      });

      map.addSource(ITEMS_SOURCE, {
        type: "geojson",
        data: geo.points,
      });

      map.addSource(LINKS_SOURCE, {
        type: "geojson",
        data: geo.links,
      });

      // Dashed connection lines from the plot out to each landmark.
      map.addLayer({
        id: "future-link-line",
        type: "line",
        source: LINKS_SOURCE,
        paint: {
          "line-color": "#c6a46c",
          "line-width": 1.4,
          "line-opacity": 0.65,
          "line-dasharray": [2, 2],
        },
      });

      map.addLayer({
        id: "future-item-halo",
        type: "circle",
        source: ITEMS_SOURCE,
        paint: {
          "circle-radius": 11,
          "circle-color": "#c6a46c",
          "circle-opacity": 0.18,
        },
      });

      map.addLayer({
        id: "future-item-dot",
        type: "circle",
        source: ITEMS_SOURCE,
        paint: {
          "circle-radius": 5.5,
          "circle-color": [
            "case",
            ["==", ["get", "horizon"], "2029"],
            "#c6a46c",
            "#1f5c45",
          ],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "future-item-label",
        type: "symbol",
        source: ITEMS_SOURCE,
        layout: {
          "text-field": ["format", ["get", "name"], {}, "\n", {}, ["get", "meta"], { "font-scale": 0.8 }],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 0.9],
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#24231f",
          "text-halo-color": "rgba(255,255,255,0.9)",
          "text-halo-width": 1.5,
        },
      });

      // The plot itself, pinned in gold with its name beneath.
      map.addLayer({
        id: "future-origin-halo",
        type: "circle",
        source: ORIGIN_SOURCE,
        paint: {
          "circle-radius": 16,
          "circle-color": "#c6a46c",
          "circle-opacity": 0.22,
        },
      });

      map.addLayer({
        id: "future-origin-dot",
        type: "circle",
        source: ORIGIN_SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": "#c6a46c",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#24231f",
        },
      });

      map.addLayer({
        id: "future-origin-label",
        type: "symbol",
        source: ORIGIN_SOURCE,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 12,
          "text-anchor": "bottom",
          "text-offset": [0, -1.1],
        },
        paint: {
          "text-color": "#24231f",
          "text-halo-color": "rgba(255,255,255,0.92)",
          "text-halo-width": 1.6,
        },
      });
    });

    return () => {
      readyRef.current = false;
      mapRef.current = null;
      map.remove();
    };
    // The map is created once; data updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push the current horizon's data into the map and keep everything in frame.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    const itemsSource = map.getSource(ITEMS_SOURCE) as GeoJSONSource | undefined;
    const linksSource = map.getSource(LINKS_SOURCE) as GeoJSONSource | undefined;
    itemsSource?.setData(geo.points);
    linksSource?.setData(geo.links);

    if (geo.points.features.length === 0) return;

    // Frame the plot plus every landmark, using the same coordinates that
    // were just pushed into the source.
    const bounds = new LngLatBounds(origin, origin);
    for (const feature of geo.points.features) {
      bounds.extend(feature.geometry.coordinates as [number, number]);
    }

    map.fitBounds(bounds, { padding: 64, maxZoom: 14, duration: 600 });
  }, [geo, origin]);

  // The map lives in a fluid grid column, so it must re-measure on resize.
  useEffect(() => {
    const map = mapRef.current;
    const node = containerRef.current;
    if (!map || !node) return;

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="pd-section pd-future" aria-labelledby="pd-future-title">
      <div className="pd-section__inner">
        <p className="pd-kicker">Future neighbourhood</p>
        <h2 id="pd-future-title">Not just today. A brighter 2029.</h2>
        <p className="pd-section__lead">
          Toggle between what already surrounds this plot and the infrastructure
          expected to reshape the belt over the next few years.
        </p>

        <div className="pd-future__toggles">
          <div className="pd-segment" role="group" aria-label="Time horizon">
            <button
              type="button"
              className={horizon === "today" ? "is-active" : ""}
              aria-pressed={horizon === "today"}
              onClick={() => setHorizon("today")}
            >
              Today
            </button>
            <button
              type="button"
              className={horizon === "2029" ? "is-active" : ""}
              aria-pressed={horizon === "2029"}
              onClick={() => setHorizon("2029")}
            >
              In 2029
            </button>
          </div>
          <button
            type="button"
            className={`pd-chip${nearBy ? " is-active" : ""}`}
            aria-pressed={nearBy}
            onClick={() => setNearBy((value) => !value)}
          >
            Near by me
          </button>
        </div>

        {nearBy ? (
          <p className="pd-future__near" aria-live="polite">
            ~{fromGachibowli.toFixed(1)} km from Gachibowli (demo) — not device
            GPS.
          </p>
        ) : null}

        <div className="pd-future__layout">
          <ul className="pd-future__list">
            {items.map((item) => (
              <li key={item.id} className="pd-future__card">
                <div className="pd-future__card-top">
                  <p className="pd-future__kind">{item.kind}</p>
                  <p className="pd-future__status">{item.status}</p>
                </div>
                <h3>{item.name}</h3>
                <p>{item.detail}</p>
                <p className="pd-future__dist">{item.distanceKm.toFixed(1)} km away</p>
              </li>
            ))}
          </ul>

          <div className="pd-future__map">
            <div
              ref={containerRef}
              className="pd-future__canvas"
              role="application"
              aria-label={`Map of ${property.neighbourhood.mapLabel} and nearby landmarks`}
            />
            {mapFailed ? (
              <p className="pd-future__map-error">
                Map unavailable offline — the list beside it still has the full
                detail.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}