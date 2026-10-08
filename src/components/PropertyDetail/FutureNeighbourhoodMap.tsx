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
import {
  fetchNearbyPlaces,
  isPropertyUuid,
  type ApiNearbyPlace,
} from "@/services/propertiesService";

type Horizon = "today" | "2029";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const ITEMS_SOURCE = "future-items";
const LINKS_SOURCE = "future-links";
const ORIGIN_SOURCE = "future-origin-src";

const EARTH_RADIUS_KM = 6371;

export interface NearbyPlaceItem {
  id: string;
  name: string;
  kind: string;
  distanceKm: number;
  status: string;
  detail: string;
  coordinates: [number, number];
  category?: string;
  proximityLabel?: string;
  expectedYear?: number | null;
  horizon?: Horizon;
}

function formatDistanceDisplay(dist: number | null | undefined): string {
  if (dist == null || !Number.isFinite(dist)) return "Nearby";
  return `${dist.toFixed(1)} km`;
}

/** Formats uppercase category strings into clear human readable kinds */
function formatCategoryLabel(category: string): string {
  const map: Record<string, string> = {
    AIRPORT: "Airport",
    BUSINESS: "Business & IT Park",
    HIGHWAY: "Highway / Expressway",
    HOSPITAL: "Healthcare",
    ORR: "Outer Ring Road",
    PARK: "Parks & Recreation",
    SCHOOL: "Education & School",
    METRO: "Metro Station",
    MALL: "Shopping & Retail",
    TRANSIT: "Transit Hub",
  };
  if (map[category]) return map[category];
  return category
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Formats proximity labels into friendly badges */
function formatProximityLabel(label?: string | null): string {
  if (!label) return "";
  const map: Record<string, string> = {
    WALKING: "Walking Distance",
    VERY_CLOSE: "Very Close",
    NEARBY: "Nearby Drive",
    SHORT_DRIVE: "Short Drive",
    MODERATE_DRIVE: "Moderate Drive",
    FURTHER_DRIVE: "Drive Distance",
  };
  return map[label] || label.replace(/_/g, " ").toLowerCase();
}

/** Converts ApiNearbyPlace items to standard display items */
function mapApiNearbyPlace(item: ApiNearbyPlace): NearbyPlaceItem {
  const isProposed =
    item.status === "PROPOSED" ||
    item.status === "UPCOMING" ||
    item.status === "PLANNED" ||
    Boolean(item.expected_year && item.expected_year > 2026);

  const kind = formatCategoryLabel(item.category);
  const statusDisplay = item.expected_year
    ? `Expected ${item.expected_year}`
    : item.status === "OPERATIONAL"
      ? "Operational"
      : item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase();

  const prox = formatProximityLabel(item.proximity_label);
  const detail = prox
    ? `${prox} · ${kind}`
    : `${kind} · ${item.distance} ${item.distance_unit}`;

  const distNum =
    typeof item.distance === "number" && Number.isFinite(item.distance)
      ? item.distance
      : Number(item.distance) || 0;

  return {
    id: item.id,
    name: item.name,
    kind,
    distanceKm: distNum,
    status: statusDisplay,
    detail,
    coordinates: [item.longitude, item.latitude],
    category: item.category,
    proximityLabel: prox,
    expectedYear: item.expected_year,
    horizon: isProposed ? "2029" : "today",
  };
}

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
  items: (NeighbourhoodItem | NearbyPlaceItem)[],
  origin: [number, number],
  horizon: Horizon,
) {
  const step = 360 / Math.max(items.length, 1);

  const points: Feature<Point>[] = items.map((item, index) => {
    // If exact coordinates are available, use them; otherwise use offset calculation
    const hasCoordinates =
      Array.isArray(item.coordinates) &&
      item.coordinates.length === 2 &&
      Number.isFinite(item.coordinates[0]) &&
      Number.isFinite(item.coordinates[1]) &&
      !(item.coordinates[0] === 0 && item.coordinates[1] === 0);

    const coords = hasCoordinates
      ? (item.coordinates as [number, number])
      : offsetFrom(origin, item.distanceKm, step * index + 24);

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: coords,
      },
      properties: {
        name: item.name,
        meta: `${item.kind} · ${formatDistanceDisplay(item.distanceKm)} · ${item.status}`,
        status: item.status,
        horizon,
      },
    };
  });

  const links: Feature<LineString>[] = items.map((item, index) => {
    const hasCoordinates =
      Array.isArray(item.coordinates) &&
      item.coordinates.length === 2 &&
      Number.isFinite(item.coordinates[0]) &&
      Number.isFinite(item.coordinates[1]) &&
      !(item.coordinates[0] === 0 && item.coordinates[1] === 0);

    const coords = hasCoordinates
      ? (item.coordinates as [number, number])
      : offsetFrom(origin, item.distanceKm, step * index + 24);

    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [origin, coords],
      },
      properties: { horizon },
    };
  });

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
  const [apiPlaces, setApiPlaces] = useState<ApiNearbyPlace[] | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);

  // Fetch live nearby places from /api/properties/{id}/nearby-places when property ID is a UUID
  // Or fallback to the sample property UUID (6429f090-c01d-4bcc-9145-b9bfb8595843)
  useEffect(() => {
    const targetPropertyId = isPropertyUuid(property.id)
      ? property.id
      : "6429f090-c01d-4bcc-9145-b9bfb8595843";

    const controller = new AbortController();
    setIsLoadingApi(true);

    fetchNearbyPlaces(targetPropertyId, controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        if (Array.isArray(data) && data.length > 0) {
          setApiPlaces(data);
        } else {
          setApiPlaces(null);
        }
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.warn("[neighbourhood] nearby-places fetch failed, using fallback catalogue:", error);
        setApiPlaces(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoadingApi(false);
        }
      });

    return () => controller.abort();
  }, [property.id]);

  const items: (NeighbourhoodItem | NearbyPlaceItem)[] = useMemo(() => {
    if (apiPlaces && apiPlaces.length > 0) {
      const mapped = apiPlaces.map(mapApiNearbyPlace);
      const filtered = mapped.filter((item) => item.horizon === horizon);
      // If there are no items for this horizon specifically (e.g. all places are OPERATIONAL),
      // show the operational ones rather than leaving the section empty
      if (filtered.length > 0) {
        return filtered;
      }
      return mapped;
    }

    return horizon === "today"
      ? property.neighbourhood.existing
      : property.neighbourhood.proposed;
  }, [apiPlaces, horizon, property.neighbourhood.existing, property.neighbourhood.proposed]);

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

      // Underlay halo for connection lines so they pop over map background (roads, satellite, etc.)
      map.addLayer({
        id: "future-link-glow",
        type: "line",
        source: LINKS_SOURCE,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#ffffff",
          "line-width": 6,
          "line-opacity": 0.95,
        },
      });

      // Clear, high-contrast dashed connectivity lines from plot to landmarks
      map.addLayer({
        id: "future-link-line",
        type: "line",
        source: LINKS_SOURCE,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#b45309",
          "line-width": 3,
          "line-opacity": 1,
          "line-dasharray": [2, 1.5],
        },
      });

      map.addLayer({
        id: "future-item-halo",
        type: "circle",
        source: ITEMS_SOURCE,
        paint: {
          "circle-radius": 14,
          "circle-color": [
            "case",
            ["==", ["get", "horizon"], "2029"],
            "#c6a46c",
            "#1f5c45",
          ],
          "circle-opacity": 0.25,
        },
      });

      map.addLayer({
        id: "future-item-dot",
        type: "circle",
        source: ITEMS_SOURCE,
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "case",
            ["==", ["get", "horizon"], "2029"],
            "#c6a46c",
            "#1f5c45",
          ],
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "future-item-label",
        type: "symbol",
        source: ITEMS_SOURCE,
        layout: {
          "text-field": ["format", ["get", "name"], { "font-scale": 0.95 }, "\n", {}, ["get", "meta"], { "font-scale": 0.85 }],
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 1.1],
          "text-allow-overlap": false,
          "text-ignore-placement": false,
          "text-optional": true,
        },
        paint: {
          "text-color": "#171717",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2.5,
        },
      });

      // The plot itself, pinned in gold with its name beneath.
      map.addLayer({
        id: "future-origin-halo",
        type: "circle",
        source: ORIGIN_SOURCE,
        paint: {
          "circle-radius": 22,
          "circle-color": "#c6a46c",
          "circle-opacity": 0.3,
        },
      });

      map.addLayer({
        id: "future-origin-dot",
        type: "circle",
        source: ORIGIN_SOURCE,
        paint: {
          "circle-radius": 9,
          "circle-color": "#c6a46c",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "future-origin-label",
        type: "symbol",
        source: ORIGIN_SOURCE,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 13,
          "text-anchor": "bottom",
          "text-offset": [0, -1.2],
        },
        paint: {
          "text-color": "#171717",
          "text-halo-color": "#ffffff",
          "text-halo-width": 2.5,
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
    if (!map) return;

    const applyData = () => {
      try {
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
      } catch (err) {
        console.warn("[neighbourhood map] data update error", err);
      }
    };

    if (!readyRef.current || !map.isStyleLoaded()) {
      map.once("load", applyData);
      return () => {
        map.off("load", applyData);
      };
    }

    applyData();
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
            {isLoadingApi && items.length === 0 ? (
              <li className="pd-future__card">
                <p className="text-sm text-neutral-500">Loading nearby landmarks…</p>
              </li>
            ) : null}
            {items.map((item) => (
              <li
                key={item.id}
                className="pd-future__card cursor-pointer"
                onClick={() => {
                  const map = mapRef.current;
                  if (!map) return;
                  const targetCoords =
                    Array.isArray(item.coordinates) &&
                    Number.isFinite(item.coordinates[0]) &&
                    Number.isFinite(item.coordinates[1]) &&
                    !(item.coordinates[0] === 0 && item.coordinates[1] === 0)
                      ? (item.coordinates as [number, number])
                      : origin;

                  const bounds = new LngLatBounds(origin, origin);
                  bounds.extend(targetCoords);
                  map.fitBounds(bounds, {
                    padding: 90,
                    maxZoom: 14.5,
                    duration: 800,
                  });
                }}
              >
                <div className="pd-future__card-top">
                  <span className="pd-future__kind">{item.kind}</span>
                  <span className="pd-future__status">{item.status}</span>
                </div>
                <h3>{item.name}</h3>
                <p>{item.detail}</p>
                <div className="flex items-center justify-between mt-2 pt-1 border-t border-black/5">
                  <p className="pd-future__dist">{formatDistanceDisplay(item.distanceKm)} away</p>
                  {"proximityLabel" in item && item.proximityLabel ? (
                    <span className="text-[10px] uppercase font-bold text-[#c6a46c] bg-[#c6a46c]/10 px-2 py-0.5 rounded">
                      {item.proximityLabel}
                    </span>
                  ) : null}
                </div>
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